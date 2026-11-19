import type { APIRoute } from "astro";
import { field, safeNext, withQuery } from "../../../../lib/academy/http";
import { isKnownDevice, rememberDevice } from "../../../../lib/academy/devices";
import { deviceLabel, emailNewSignIn } from "../../../../lib/academy/emails";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect, cookies, url }) => {
  const form = await request.formData();
  const email = field(form, "email");
  const password = form.get("password");
  const next = safeNext(form.get("next"));

  if (!email || typeof password !== "string" || !password) {
    return redirect(withQuery("/academy/login", { error: "missing", next }), 303);
  }

  const { data, error } = await locals.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // One generic message for wrong email, wrong password and unconfirmed accounts.
    const code = error.code === "email_not_confirmed" ? "unconfirmed" : "bad-login";
    return redirect(withQuery("/academy/login", { error: code, next }), 303);
  }
  // New-device alert (skipped for accounts created in the last 10 minutes).
  if (!isKnownDevice(cookies) && data.user?.email) {
    const createdMs = new Date(data.user.created_at).getTime();
    if (Date.now() - createdMs > 10 * 60 * 1000) {
      await emailNewSignIn({
        to: data.user.email,
        when: new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }) + " (UK time)",
        device: deviceLabel(request.headers.get("user-agent")),
        resetUrl: `${url.origin}/academy/forgot-password`,
      });
    }
  }
  rememberDevice(cookies);

  // Accounts with two-factor on must enter their authenticator code next.
  const { data: aal } = await locals.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return redirect(withQuery("/academy/mfa", { next }), 303);
  return redirect(next, 303);
};
