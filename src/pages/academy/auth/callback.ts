import type { APIRoute } from "astro";
import type { EmailOtpType } from "@supabase/supabase-js";
import { audit } from "../../../lib/academy/audit";
import { clientIp, safeNext, withQuery } from "../../../lib/academy/http";

export const prerender = false;

// Landing point for email confirmation, password-reset and Discord-link redirects.
export const GET: APIRoute = async ({ url, locals, redirect, request }) => {
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

  if (next.includes("discord-linked") && result.data.user.identities?.some((i) => i.provider === "discord")) {
    await audit({ actorId: result.data.user.id, action: "auth.discord_linked", ip: clientIp(request) });
  }
  return redirect(next, 303);
};
