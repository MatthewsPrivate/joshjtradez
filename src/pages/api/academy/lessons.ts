// Lesson create / update / video / reorder / delete. RLS (can_manage_course) authorises.
import type { APIRoute } from "astro";
import { backTo, bool, done, isUuid, optStr, str } from "../../../lib/academy/forms";
import { createServiceClient } from "../../../lib/academy/supabase";
import { embedUrl, parseDuration } from "../../../lib/academy/video";

export const prerender = false;

const BUILDER = "/academy/teacher/course-builder";

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const db = ctx.locals.supabase;
  const intent = str(form, "intent");
  const back = backTo(form, BUILDER);

  if (intent === "create") {
    const moduleId = str(form, "module_id");
    const title = str(form, "title", 200);
    if (!isUuid(moduleId) || !title) return done(ctx, back, { error: "invalid" });
    const { data: last } = await db.from("lessons").select("position").eq("module_id", moduleId).order("position", { ascending: false }).limit(1).maybeSingle();
    // course_id is filled in from the module by a trigger.
    const { data, error } = await db
      .from("lessons")
      .insert({ module_id: moduleId, title, position: (last?.position ?? -1) + 1, body: { markdown: "" } })
      .select("id, course_id")
      .single();
    if (error) return done(ctx, back, { error: error.code === "42501" ? "not-allowed" : "failed" });
    return done(ctx, `${BUILDER}/${data.course_id}/lessons/${data.id}`, { notice: "created" });
  }

  const id = str(form, "id");
  if (!isUuid(id)) return done(ctx, back, { error: "invalid" });

  if (intent === "update") {
    const title = str(form, "title", 200);
    const status = str(form, "status");
    const videoUrl = optStr(form, "video_url", 500);
    const moduleId = str(form, "module_id");
    if (!title || !["draft", "published"].includes(status)) return done(ctx, back, { error: "invalid" });
    if (videoUrl && !embedUrl(videoUrl)) return done(ctx, back, { error: "bad-video-url" });
    const { error, count } = await db
      .from("lessons")
      .update(
        {
          title,
          summary: str(form, "summary", 600),
          body: { markdown: str(form, "body", 100_000) },
          video_url: videoUrl,
          duration_seconds: parseDuration(str(form, "duration")),
          is_preview: bool(form, "is_preview"),
          status,
          ...(isUuid(moduleId) ? { module_id: moduleId } : {}),
        },
        { count: "exact" },
      )
      .eq("id", id);
    return done(ctx, back, error || !count ? { error: error ? "failed" : "not-allowed" } : { notice: "saved" });
  }

  if (intent === "set-video" || intent === "clear-video") {
    const { data: lesson } = await db.from("lessons").select("course_id, video_path").eq("id", id).maybeSingle();
    if (!lesson) return done(ctx, back, { error: "not-found" });
    const path = intent === "set-video" ? str(form, "storage_path", 500) : null;
    if (path !== null && !path.startsWith(`${lesson.course_id}/${id}/`)) return done(ctx, back, { error: "invalid" });
    const durationRaw = str(form, "duration_seconds");
    const duration = /^\d+$/.test(durationRaw) ? Number(durationRaw) : undefined;
    const { error, count } = await db
      .from("lessons")
      .update({ video_path: path, ...(duration ? { duration_seconds: duration } : {}) }, { count: "exact" })
      .eq("id", id);
    if (error || !count) return done(ctx, back, { error: error ? "failed" : "not-allowed" });
    if (lesson.video_path && lesson.video_path !== path) {
      await createServiceClient().storage.from("course-media").remove([lesson.video_path]);
    }
    return done(ctx, back, { notice: "saved" });
  }

  if (intent === "move-up" || intent === "move-down") {
    const { data: lesson } = await db.from("lessons").select("module_id").eq("id", id).maybeSingle();
    if (!lesson) return done(ctx, back, { error: "not-found" });
    const { data: siblings } = await db.from("lessons").select("id, position").eq("module_id", lesson.module_id).order("position");
    const list = siblings ?? [];
    const i = list.findIndex((l) => l.id === id);
    const j = intent === "move-up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return done(ctx, back);
    [list[i], list[j]] = [list[j]!, list[i]!];
    for (const [pos, l] of list.entries()) {
      if (l.position !== pos) await db.from("lessons").update({ position: pos }).eq("id", l.id);
    }
    return done(ctx, back);
  }

  if (intent === "delete") {
    const { data: lesson } = await db.from("lessons").select("course_id, video_path").eq("id", id).maybeSingle();
    const { data: resources } = await db.from("lesson_resources").select("storage_path").eq("lesson_id", id);
    const { error, count } = await db.from("lessons").delete({ count: "exact" }).eq("id", id);
    if (error || !count) return done(ctx, back, { error: error ? "failed" : "not-allowed" });
    const files = [lesson?.video_path, ...(resources ?? []).map((r) => r.storage_path)].filter((p): p is string => Boolean(p));
    if (files.length) await createServiceClient().storage.from("course-media").remove(files);
    return done(ctx, `${BUILDER}/${lesson?.course_id ?? ""}`, { notice: "deleted" });
  }

  return done(ctx, back, { error: "invalid" });
};
