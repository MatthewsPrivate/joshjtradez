import type { APIRoute } from "astro";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext, withQuery } from "../../../lib/academy/http";
import { claimOrdersFor } from "../../../lib/academy/payments/fulfil";
import { rememberDevice } from "../../../lib/academy/devices";

export const prerender = false;

// Landing point for email confirmation and password-reset links.
export const GET: APIRoute = async ({ url, locals, redirect, cookies }) => {
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const result = code
    ? await locals.supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await locals.supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : null;

  if (!result || result.error || !result.data.user) {
    return redirect(withQuery("/academy/login", { error: "link-expired" }), 303);
  }

  // Someone who bought as a guest and then signed up normally: once their email
  // is confirmed, attach those purchases to the new account.
  if (result.data.user.email_confirmed_at) await claimOrdersFor(result.data.user.id);
  rememberDevice(cookies);

  return redirect(next, 303);
};
