// Save / unsave a course to the student's "Saved" tab.
import type { APIRoute } from "astro";
import { backTo, done, isUuid, str } from "../../../lib/academy/forms";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const courseId = str(form, "course_id");
  const back = backTo(form, "/academy/student/my-academy");
  if (!isUuid(courseId)) return done(ctx, back, { error: "invalid" });
  const table = ctx.locals.supabase.from("course_bookmarks");
  const { error } =
    str(form, "intent") === "remove"
      ? await table.delete().eq("course_id", courseId).eq("user_id", ctx.locals.user!.id)
      : await table.upsert({ course_id: courseId, user_id: ctx.locals.user!.id }, { onConflict: "user_id,course_id" });
  return done(ctx, back, error ? { error: "failed" } : undefined);
};
