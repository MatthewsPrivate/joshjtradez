// (Re)send the email verification code for a paid guest checkout.
import type { APIRoute } from "astro";
import { str } from "../../../../lib/academy/forms";
import { withQuery } from "../../../../lib/academy/http";
import { issueClaimCode } from "../../../../lib/academy/codes";
import { emailPurchaseCode } from "../../../../lib/academy/emails";
import { syncCheckout } from "../../../../lib/academy/payments/fulfil";
import { createServiceClient } from "../../../../lib/academy/supabase";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData().catch(() => null);
  const sessionId = form ? str(form, "session_id", 300) : "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return ctx.redirect("/", 303);
  const back = (q: Record<string, string>) => withQuery("/academy/welcome", { session_id: sessionId, ...q });

  const order = (await syncCheckout(sessionId).catch(() => null))?.order;
  if (!order || order.status !== "paid" || !order.customer_email || order.user_id || order.account_claimed_at) return ctx.redirect(back({}), 303);

  const issued = await issueClaimCode(order.id, order.customer_email);
  if (!issued.ok) return ctx.redirect(back({ error: issued.reason === "cooldown" ? "code-cooldown" : issued.reason === "limit" ? "code-limit" : "failed" }), 303);
  const { data: product } = await createServiceClient().from("products").select("name").eq("id", order.product_id).maybeSingle();
  const sent = await emailPurchaseCode(order.customer_email, issued.code, product?.name ?? "your course");
  return ctx.redirect(back(sent ? { notice: "code-sent" } : { error: "email-failed" }), 303);
};
