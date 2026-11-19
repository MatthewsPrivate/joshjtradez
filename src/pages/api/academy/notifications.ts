// Mark the signed-in user's notifications as read (called when the bell opens).
import type { APIRoute } from "astro";
import { json, str } from "../../../lib/academy/forms";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const form = await request.formData().catch(() => null);
  if (!form || str(form, "intent") !== "read-all") return json({ error: "invalid" }, 400);
  const { error } = await locals.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", locals.user!.id)
    .is("read_at", null);
  return error ? json({ error: "failed" }, 500) : json({ ok: true });
};
