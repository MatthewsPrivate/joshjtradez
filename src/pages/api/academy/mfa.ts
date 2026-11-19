// Two-factor authentication (authenticator app / TOTP) via Supabase Auth MFA.
//   intent=enable    first code after scanning the QR → factor becomes verified, session aal2
//   intent=verify    sign-in step for accounts with 2FA on → session aal2
//   intent=disable   turn 2FA off (needs an aal2 session; blocked for staff when it's mandatory)
import type { APIRoute } from "astro";
import { done, str } from "../../../lib/academy/forms";
import { safeNext, withQuery } from "../../../lib/academy/http";
import { audit } from "../../../lib/academy/audit";
import { mfaRequiredFor } from "../../../lib/academy/mfa";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const { supabase, user, roles } = ctx.locals;
  const form = await ctx.request.formData();
  const intent = str(form, "intent");
  const factorId = str(form, "factor_id", 100);
  const code = str(form, "code", 12).replace(/\D/g, "");
  const next = safeNext(form.get("next"), "/academy");

  if (intent === "enable" || intent === "verify") {
    const back = intent === "enable" ? "/academy/mfa/setup" : withQuery("/academy/mfa", { next });
    if (!factorId || code.length !== 6) return done(ctx, back, { error: "mfa-wrong" });
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) {
      console.warn("[mfa] verify failed:", error.code ?? error.message);
      return done(ctx, back, { error: "mfa-wrong" });
    }
    await audit({ actorId: user!.id, action: intent === "enable" ? "mfa.enabled" : "mfa.verified", targetType: "user", targetId: user!.id });
    return intent === "enable" ? done(ctx, "/academy/settings", { notice: "mfa-enabled" }) : ctx.redirect(next, 303);
  }

  if (intent === "disable") {
    if (mfaRequiredFor(roles)) return done(ctx, "/academy/mfa/setup", { error: "mfa-required" });
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") return ctx.redirect(withQuery("/academy/mfa", { next: "/academy/mfa/setup" }), 303);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) return done(ctx, "/academy/mfa/setup", { error: "failed" });
    await supabase.auth.refreshSession();
    await audit({ actorId: user!.id, action: "mfa.disabled", targetType: "user", targetId: user!.id });
    return done(ctx, "/academy/settings", { notice: "mfa-disabled" });
  }

  return done(ctx, "/academy/settings", { error: "invalid" });
};
