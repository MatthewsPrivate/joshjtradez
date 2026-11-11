import type { APIRoute } from "astro";
import { field, safeNext, withQuery } from "../../../../lib/academy/http";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const email = field(form, "email");
  const password = form.get("password");
  const next = safeNext(form.get("next"));

  if (!email || typeof password !== "string" || !password) {
    return redirect(withQuery("/academy/login", { error: "missing", next }), 303);
  }

  const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // One generic message for wrong email, wrong password and unconfirmed accounts.
    const code = error.code === "email_not_confirmed" ? "unconfirmed" : "invalid";
    return redirect(withQuery("/academy/login", { error: code, next }), 303);
  }
  return redirect(next, 303);
};
