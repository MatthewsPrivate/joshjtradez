import type { APIRoute } from "astro";
import { audit } from "../../../../lib/academy/audit";
import { MIN_PASSWORD_LENGTH, clientIp, withQuery } from "../../../../lib/academy/http";

export const prerender = false;

// Requires a session — either signed in normally (change password from settings)
// or the recovery session created by the reset-email link via /academy/auth/callback.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const password = form.get("password");
  const confirm = form.get("password_confirm");
  const fail = (error: string) => redirect(withQuery("/academy/reset-password", { error }), 303);

  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) return fail("weak");
  if (password !== confirm) return fail("mismatch");

  const { error } = await locals.supabase.auth.updateUser({ password });
  if (error) return fail(error.code === "same_password" ? "same" : "failed");

  await audit({ actorId: locals.user!.id, action: "auth.password_changed", ip: clientIp(request) });
  return redirect(withQuery("/academy/settings", { notice: "password-updated" }), 303);
};
