// Triage website enquiries: set status and private notes. RLS (support.manage —
// owner/developer, or permitted admins) authorises; only these columns are writable.
import type { APIRoute } from "astro";
import { backTo, done, isUuid, str } from "../../../lib/academy/forms";

export const prerender = false;

const STATUSES = new Set(["new", "contacted", "closed", "spam"]);

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const id = str(form, "id");
  const back = backTo(form, "/academy/owner/enquiries");
  if (!isUuid(id)) return done(ctx, back, { error: "invalid" });

  const patch: Record<string, unknown> = { handled_by: ctx.locals.user!.id };
  const status = str(form, "status");
  if (status) {
    if (!STATUSES.has(status)) return done(ctx, back, { error: "invalid" });
    patch.status = status;
  }
  if (form.has("notes")) patch.notes = str(form, "notes", 5000);

  const { error, count } = await ctx.locals.supabase.from("contact_submissions").update(patch, { count: "exact" }).eq("id", id);
  return done(ctx, `${back}#${id}`, error || !count ? { error: error ? "failed" : "not-allowed" } : { notice: "saved" });
};
