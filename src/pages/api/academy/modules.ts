// Module create / rename / reorder / delete. RLS (can_manage_course) authorises.
import type { APIRoute } from "astro";
import { backTo, done, isUuid, str } from "../../../lib/academy/forms";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const db = ctx.locals.supabase;
  const intent = str(form, "intent");
  const back = backTo(form, "/academy/teacher/course-builder");

  if (intent === "create") {
    const courseId = str(form, "course_id");
    const title = str(form, "title", 200);
    if (!isUuid(courseId) || !title) return done(ctx, back, { error: "invalid" });
    const { data: last } = await db.from("modules").select("position").eq("course_id", courseId).order("position", { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from("modules").insert({ course_id: courseId, title, position: (last?.position ?? -1) + 1 });
    return done(ctx, back, error ? { error: error.code === "42501" ? "not-allowed" : "failed" } : { notice: "created" });
  }

  const id = str(form, "id");
  if (!isUuid(id)) return done(ctx, back, { error: "invalid" });

  if (intent === "update") {
    const title = str(form, "title", 200);
    if (!title) return done(ctx, back, { error: "invalid" });
    const { error, count } = await db.from("modules").update({ title, summary: str(form, "summary", 1000) }, { count: "exact" }).eq("id", id);
    return done(ctx, back, error || !count ? { error: error ? "failed" : "not-allowed" } : { notice: "saved" });
  }

  if (intent === "move-up" || intent === "move-down") {
    const { data: mod } = await db.from("modules").select("id, course_id, position").eq("id", id).maybeSingle();
    if (!mod) return done(ctx, back, { error: "not-found" });
    const { data: siblings } = await db.from("modules").select("id, position").eq("course_id", mod.course_id).order("position");
    const list = siblings ?? [];
    const i = list.findIndex((m) => m.id === id);
    const j = intent === "move-up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return done(ctx, back);
    // Renumber 0..n so duplicate positions can never stick.
    [list[i], list[j]] = [list[j]!, list[i]!];
    for (const [pos, m] of list.entries()) {
      if (m.position !== pos) await db.from("modules").update({ position: pos }).eq("id", m.id);
    }
    return done(ctx, back);
  }

  if (intent === "delete") {
    const { error, count } = await db.from("modules").delete({ count: "exact" }).eq("id", id);
    return done(ctx, back, error || !count ? { error: error ? "failed" : "not-allowed" } : { notice: "deleted" });
  }

  return done(ctx, back, { error: "invalid" });
};
