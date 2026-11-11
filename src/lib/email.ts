// Transactional email via Resend's HTTP API (https://resend.com) — no SDK needed.
// Optional: when RESEND_API_KEY isn't set, sendEmail() reports "not configured"
// and callers carry on (e.g. enquiries are still saved and shown in the portal).

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export type EmailResult = { ok: true; id: string } | { ok: false; error: string };

export const isEmailConfigured = () => Boolean(import.meta.env.RESEND_API_KEY);

// Without a verified domain, Resend only delivers from onboarding@resend.dev to
// the Resend account's own address — so create the Resend account with Josh's email,
// or verify a domain and set CONTACT_FROM_EMAIL.
const DEFAULT_FROM = "JoshJTradez Website <onboarding@resend.dev>";

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const key = import.meta.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "not configured (RESEND_API_KEY missing)" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: import.meta.env.CONTACT_FROM_EMAIL || DEFAULT_FROM,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        reply_to: msg.replyTo,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    return res.ok && body.id ? { ok: true, id: body.id } : { ok: false, error: `${res.status}: ${body.message ?? "send failed"}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
