import type { APIRoute } from "astro";
import { field, withQuery } from "../../../../lib/academy/http";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  const email = field(await request.formData(), "email");
  if (email) {
    const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${url.origin}/academy/auth/callback?next=/academy/reset-password`,
    });
    if (error) console.error("[auth] reset email failed:", error.message);
  }
  // Always the same notice, so the form can't be used to probe for accounts.
  return redirect(withQuery("/academy/forgot-password", { notice: "sent" }), 303);
};
