// Public website contact form ("Send My Details"). Validates against
// CONTACT_FIELDS, filters spam, saves the enquiry (service role — the table has
// no public insert policy) and emails Josh. Responds with JSON for the form script.
import type { APIRoute } from "astro";
import { CONTACT_FIELDS } from "../../lib/content";
import { escapeHtml, isEmailConfigured, sendEmail } from "../../lib/email";
import { createServiceClient, isSupabaseConfigured } from "../../lib/academy/supabase";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// Best-effort per-instance rate limit: 5 submissions per IP per 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const recent = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > 5;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function sameSite(request: Request): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  try {
    return Boolean(host && origin && new URL(origin).host === host);
  } catch {
    return false;
  }
}

export const POST: APIRoute = async ({ request, url }) => {
  if (!sameSite(request)) return json({ error: "forbidden" }, 403);
  if (!isSupabaseConfigured()) return json({ error: "unavailable" }, 503);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return json({ error: "rate-limited" }, 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "invalid" }, 400);
  }

  // Spam traps: a hidden field humans never fill, and a minimum fill time.
  const startedAt = Number(form.get("_started") ?? 0);
  if (String(form.get("website") ?? "") !== "" || (startedAt && Date.now() - startedAt < 2500)) {
    return json({ ok: true }); // pretend success; don't tell bots
  }

  const answers: { name: string; label: string; value: string }[] = [];
  const missing: string[] = [];
  for (const field of CONTACT_FIELDS) {
    const raw = form.get(field.name);
    const value = (typeof raw === "string" ? raw : "").trim().slice(0, field.type === "textarea" ? 3000 : 200);
    if (field.required && !value) missing.push(field.name);
    if (value && "options" in field && !(field.options as readonly string[]).includes(value)) missing.push(field.name);
    if (value) answers.push({ name: field.name, label: field.label, value });
  }
  const get = (n: string) => answers.find((a) => a.name === n)?.value ?? "";
  if (get("email") && !EMAIL_RE.test(get("email"))) missing.push("email");
  if (missing.length) return json({ error: "invalid", fields: [...new Set(missing)] }, 422);

  const db = createServiceClient();
  const { data: row, error } = await db
    .from("contact_submissions")
    .insert({
      name: get("fullName").slice(0, 120),
      email: get("email").slice(0, 320),
      phone: get("phone").slice(0, 40) || null,
      country: get("country").slice(0, 80) || null,
      answers,
      ip: ip === "unknown" ? null : ip,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    })
    .select("id")
    .single();
  if (error || !row) {
    console.error("[contact] save failed:", error?.message);
    return json({ error: "failed" }, 500);
  }

  // Notify Josh. A failed email never loses the enquiry — it's already saved.
  const notify = (import.meta.env.CONTACT_NOTIFY_EMAIL || import.meta.env.ACADEMY_OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (isEmailConfigured() && notify.length) {
    // Public host the visitor used (the function's own URL can be internal on Vercel).
    const host = request.headers.get("x-forwarded-host") ?? url.host;
    const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
    const portal = `${proto}://${host}/academy/owner/enquiries#${row.id}`;
    const lines = answers.map((a) => `${a.label}: ${a.value}`);
    const result = await sendEmail({
      to: notify,
      replyTo: get("email"),
      subject: `New enquiry: ${get("fullName")}${get("experience") ? ` (${get("experience")})` : ""}`,
      text: `New enquiry from the JoshJTradez website.\n\n${lines.join("\n")}\n\nReply to this email to answer them directly.\nView in your Owner portal: ${portal}`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111">
<p><strong>New enquiry from the JoshJTradez website</strong></p>
<table cellpadding="6" style="border-collapse:collapse">${answers
        .map((a) => `<tr><td style="color:#666;vertical-align:top;white-space:nowrap">${escapeHtml(a.label)}</td><td>${escapeHtml(a.value).replace(/\n/g, "<br>")}</td></tr>`)
        .join("")}</table>
<p>Reply to this email to answer them directly.</p>
<p><a href="${escapeHtml(portal)}">View in your Owner portal</a></p></div>`,
    });
    await db
      .from("contact_submissions")
      .update(result.ok ? { email_sent_at: new Date().toISOString(), email_error: null } : { email_error: result.error.slice(0, 500) })
      .eq("id", row.id);
    if (!result.ok) console.error("[contact] email failed:", result.error);
  }

  return json({ ok: true });
};
