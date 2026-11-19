// After a guest pays: create their academy account with the email they paid
// with, sign them in and unlock the course.
//
// Safety: only possible when (a) Stripe confirms the session is paid, checked
// server-to-server, (b) the buyer enters the code we emailed to that address
// (proves they own the inbox — skipped only while email isn't configured),
// (c) no account exists for that email yet, and (d) this order hasn't already
// been used to create an account. If an account exists we
// never let the payer set its password — they're sent to sign in instead.
import type { APIRoute } from "astro";
import { str } from "../../../../lib/academy/forms";
import { MIN_PASSWORD_LENGTH, withQuery } from "../../../../lib/academy/http";
import { audit } from "../../../../lib/academy/audit";
import { verifyClaimCode } from "../../../../lib/academy/codes";
import { isEmailConfigured } from "../../../../lib/academy/emails";
import { rememberDevice } from "../../../../lib/academy/devices";
import { claimOrdersFor, syncCheckout } from "../../../../lib/academy/payments/fulfil";
import { createServiceClient } from "../../../../lib/academy/supabase";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData().catch(() => null);
  const sessionId = form ? str(form, "session_id", 300) : "";
  const welcome = (err?: string) => withQuery("/academy/welcome", { session_id: sessionId, ...(err ? { error: err } : {}) });
  if (!form || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return ctx.redirect("/academy/login?error=invalid", 303);

  const name = str(form, "full_name", 120);
  const password = form.get("password");
  const confirm = form.get("confirm");
  if (!name || typeof password !== "string" || !password) return ctx.redirect(welcome("missing"), 303);
  if (password.length < MIN_PASSWORD_LENGTH) return ctx.redirect(welcome("weak"), 303);
  if (password !== confirm) return ctx.redirect(welcome("mismatch"), 303);

  let synced;
  try {
    synced = await syncCheckout(sessionId);
  } catch (err) {
    console.error("[claim] lookup failed:", err instanceof Error ? err.message : err);
    return ctx.redirect(welcome("failed"), 303);
  }
  const order = synced?.order;
  if (!order || order.status !== "paid" || !order.customer_email) return ctx.redirect(welcome("not-paid"), 303);
  if (order.user_id || order.account_claimed_at) return ctx.redirect(withQuery("/academy/login", { notice: "account-exists", next: "/academy/student/my-academy" }), 303);

  if (isEmailConfigured()) {
    const result = await verifyClaimCode(order.id, str(form, "code", 20));
    if (result !== "ok") return ctx.redirect(welcome(result === "wrong" ? "code-wrong" : result === "locked" ? "code-locked" : "code-expired"), 303);
  }

  const db = createServiceClient();
  const { data: existing } = await db.rpc("user_id_by_email", { e: order.customer_email });
  if (existing) return ctx.redirect(withQuery("/academy/login", { notice: "account-exists", next: "/academy/student/my-academy" }), 303);

  // Reserve this order for account creation (single use, race-safe).
  const { data: reserved } = await db
    .from("orders")
    .update({ account_claimed_at: new Date().toISOString() })
    .eq("id", order.id)
    .is("account_claimed_at", null)
    .is("user_id", null)
    .select("id")
    .maybeSingle();
  if (!reserved) return ctx.redirect(withQuery("/academy/login", { notice: "account-exists" }), 303);

  const { data: created, error } = await db.auth.admin.createUser({
    email: order.customer_email,
    password,
    // They proved control of the purchase (Stripe sends the receipt to this address).
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !created.user) {
    console.error("[claim] create user failed:", error?.message);
    await db.from("orders").update({ account_claimed_at: null }).eq("id", order.id);
    return ctx.redirect(welcome(error?.message?.toLowerCase().includes("password") ? "weak" : "failed"), 303);
  }

  await claimOrdersFor(created.user.id);
  await audit({ actorId: created.user.id, action: "account.created_after_purchase", targetType: "order", targetId: order.id });

  const { error: signInError } = await ctx.locals.supabase.auth.signInWithPassword({ email: order.customer_email, password });
  // This browser is now a known device — no "new sign-in" alert for it.
  rememberDevice(ctx.cookies);
  if (signInError) return ctx.redirect(withQuery("/academy/login", { notice: "account-ready" }), 303);

  const { data: course } = await db.from("product_courses").select("courses(slug)").eq("product_id", order.product_id).limit(1).maybeSingle();
  const slug = (course as unknown as { courses: { slug: string } | null } | null)?.courses?.slug;
  return ctx.redirect(slug ? `/academy/student/courses/${slug}?notice=purchase-complete` : "/academy/student/my-academy?notice=purchase-complete", 303);
};
