import type { APIRoute } from "astro";
import { MIN_PASSWORD_LENGTH, field, withQuery } from "../../../../lib/academy/http";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  const form = await request.formData();
  const fullName = field(form, "full_name").slice(0, 120);
  const email = field(form, "email");
  const password = form.get("password");
  const confirm = form.get("password_confirm");

  const fail = (error: string) => redirect(withQuery("/academy/signup", { error }), 303);
  if (!fullName || !email || typeof password !== "string") return fail("missing");
  if (password.length < MIN_PASSWORD_LENGTH) return fail("weak");
  if (password !== confirm) return fail("mismatch");

  const { error } = await locals.supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${url.origin}/academy/auth/callback?next=/academy`,
    },
  });
  if (error) return fail(error.code === "weak_password" ? "weak" : "failed");

  // Same response whether or not the email already exists (no account enumeration).
  return redirect(withQuery("/academy/login", { notice: "check-email" }), 303);
};
