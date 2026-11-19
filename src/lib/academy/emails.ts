// Every email the academy sends, in one place, with one look.
//
// Env:
//   RESEND_API_KEY        required for any email to send
//   ACADEMY_FROM_EMAIL    e.g. "JoshJTradez Academy <academy@yourdomain.com>" — must be on a
//                         domain verified in Resend (a gmail.com address can't be a sender)
//   ACADEMY_REPLY_TO      where replies go, e.g. Josh's Gmail
//   ACADEMY_OWNER_EMAILS / ACADEMY_DEVELOPER_EMAILS   staff alert recipients
//
// Sending never throws: failures are logged, and callers carry on.
import { escapeHtml, isEmailConfigured, sendEmail } from "../email";

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const from = () => import.meta.env.ACADEMY_FROM_EMAIL || import.meta.env.CONTACT_FROM_EMAIL || undefined;
const replyTo = () => import.meta.env.ACADEMY_REPLY_TO || undefined;
export const ownerEmails = () => list(import.meta.env.ACADEMY_OWNER_EMAILS);
const opsEmails = () => [...new Set([...ownerEmails(), ...list(import.meta.env.ACADEMY_DEVELOPER_EMAILS)])];

export { isEmailConfigured };

interface Mail {
  to: string | string[];
  subject: string;
  /** Short line shown in the inbox preview. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Large monospace block, e.g. a verification code. */
  code?: string;
  footnote?: string;
}

function render(m: Mail): { html: string; text: string } {
  const p = (t: string) => `<p style="margin:0 0 14px;color:#c9cdc9;font-size:15px;line-height:1.6">${t}</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#080a09;font-family:Inter,Segoe UI,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(m.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080a09;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0e1110;border:1px solid #242a27">
<tr><td style="padding:26px 28px 6px;font:600 12px/1 'JetBrains Mono',Consolas,monospace;letter-spacing:.14em;color:#d8b564">JOSHJTRADEZ ACADEMY</td></tr>
<tr><td style="padding:14px 28px 6px"><h1 style="margin:0 0 16px;color:#f4f1e8;font-size:22px;line-height:1.3">${escapeHtml(m.heading)}</h1>
${m.paragraphs.map((t) => p(t)).join("")}
${m.code ? `<div style="margin:6px 0 18px;padding:16px;text-align:center;background:#131715;border:1px solid #303732;color:#f0d58e;font:600 30px/1 'JetBrains Mono',Consolas,monospace;letter-spacing:.35em">${escapeHtml(m.code)}</div>` : ""}
${m.button ? `<p style="margin:8px 0 18px"><a href="${escapeHtml(m.button.url)}" style="display:inline-block;padding:13px 22px;background:#d8b564;color:#080a09;font-weight:600;text-decoration:none;font-size:14px">${escapeHtml(m.button.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:6px 28px 26px;color:#636b66;font-size:12px;line-height:1.5">${m.footnote ? escapeHtml(m.footnote) + "<br><br>" : ""}Questions? Just reply to this email.</td></tr>
</table></td></tr></table></body></html>`;
  // Paragraphs may contain <strong>; strip tags for the plain-text part.
  const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  const text = [
    m.heading,
    "",
    ...m.paragraphs.map(strip),
    m.code ? `\n    ${m.code}\n` : "",
    m.button ? `${m.button.label}: ${m.button.url}` : "",
    m.footnote ? `\n${m.footnote}` : "",
    "\nQuestions? Just reply to this email.\n— JoshJTradez Academy",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
  return { html, text };
}

async function send(m: Mail): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  const to = Array.isArray(m.to) ? m.to : [m.to];
  if (!to.length) return false;
  const { html, text } = render(m);
  const res = await sendEmail({ to, subject: m.subject, html, text, from: from(), replyTo: replyTo() });
  if (!res.ok) console.error(`[email] "${m.subject}" failed:`, res.error);
  return res.ok;
}

const esc = escapeHtml;

export function emailPurchaseCode(to: string, code: string, productName: string) {
  return send({
    to,
    subject: `${code} is your JoshJTradez Academy code`,
    preheader: `Enter ${code} to finish setting up your account.`,
    heading: "Confirm your email",
    paragraphs: [`Thanks for buying <strong>${esc(productName)}</strong>. Enter this code on the welcome page to create your account:`],
    code,
    footnote: "The code expires in 10 minutes. If you didn't just buy a course, you can ignore this email.",
  });
}

export function emailPurchaseConfirmation(opts: { to: string; productName: string; amount: string; url: string; hasAccount: boolean }) {
  return send({
    to: opts.to,
    subject: `You're in: ${opts.productName}`,
    preheader: `Payment of ${opts.amount} confirmed.`,
    heading: "Payment confirmed — welcome",
    paragraphs: [
      `Your payment of <strong>${esc(opts.amount)}</strong> for <strong>${esc(opts.productName)}</strong> went through.`,
      opts.hasAccount
        ? "The course is now on your academy account. Sign in to start learning."
        : "If you didn't finish setting up your account, use the button below — you'll get a code at this address to confirm it's you.",
    ],
    button: { label: opts.hasAccount ? "Start learning" : "Finish setting up your account", url: opts.url },
    footnote: "Stripe sends your payment receipt separately.",
  });
}

export function emailRefund(opts: { to: string; productName: string; amount: string; full: boolean }) {
  return send({
    to: opts.to,
    subject: `Refund processed: ${opts.productName}`,
    preheader: `${opts.amount} is on its way back to you.`,
    heading: "Your refund is on its way",
    paragraphs: [
      `We've refunded <strong>${esc(opts.amount)}</strong> for <strong>${esc(opts.productName)}</strong>. It usually reaches your account within 5–10 working days.`,
      opts.full ? "Access to the course has ended." : "This was a partial refund, so your course access continues.",
    ],
  });
}

export function emailOwnersSale(opts: { productName: string; amount: string; buyer: string; url: string }) {
  return send({
    to: ownerEmails(),
    subject: `New sale: ${opts.productName} (${opts.amount})`,
    preheader: `${opts.buyer} just bought ${opts.productName}.`,
    heading: `New sale — ${opts.amount}`,
    paragraphs: [`<strong>${esc(opts.buyer)}</strong> just bought <strong>${esc(opts.productName)}</strong>.`],
    button: { label: "View sales", url: opts.url },
  });
}

export function emailNewSignIn(opts: { to: string; when: string; device: string; resetUrl: string }) {
  return send({
    to: opts.to,
    subject: "New sign-in to your JoshJTradez Academy account",
    preheader: `Signed in ${opts.when} on ${opts.device}.`,
    heading: "New sign-in to your account",
    paragraphs: [`Your account was just signed in to on a new device.`, `<strong>When:</strong> ${esc(opts.when)}<br><strong>Device:</strong> ${esc(opts.device)}`, "If this was you, there's nothing to do."],
    button: { label: "Wasn't me — reset my password", url: opts.resetUrl },
  });
}

// Ops alerts are throttled per subject so a retrying webhook doesn't flood inboxes.
const lastAlert = new Map<string, number>();
export function emailOpsAlert(subject: string, detail: string) {
  const now = Date.now();
  if (now - (lastAlert.get(subject) ?? 0) < 10 * 60 * 1000) return Promise.resolve(false);
  lastAlert.set(subject, now);
  return send({
    to: opsEmails(),
    subject: `⚠ Academy alert: ${subject}`,
    preheader: detail.slice(0, 120),
    heading: subject,
    paragraphs: [esc(detail), "Open the Developer portal for details. Stripe retries failed webhooks automatically for up to 3 days."],
  });
}

/** "Chrome on Windows" style label from a user-agent string. */
export function deviceLabel(ua: string | null): string {
  if (!ua) return "an unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "an unknown system";
  return `${browser} on ${os}`;
}
