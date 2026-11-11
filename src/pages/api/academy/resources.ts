// Lesson resources: uploaded files (PDFs, images, documents) or external links.
import type { APIRoute } from "astro";
import { backTo, done, isUuid, str } from "../../../lib/academy/forms";
import { createServiceClient } from "../../../lib/academy/supabase";

export const prerender = false;

function kindFor(path: string): "pdf" | "image" | "video" | "file" {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "m4v"].includes(ext)) return "video";
  return "file";
}

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const db = ctx.locals.supabase;
  const intent = str(form, "intent");
  const back = backTo(form, "/academy/teacher/course-builder");

  if (intent === "create-file" || intent === "create-link") {
    const lessonId = str(form, "lesson_id");
    if (!isUuid(lessonId)) return done(ctx, back, { error: "invalid" });
    const { data: lesson } = await db.from("lessons").select("course_id").eq("id", lessonId).maybeSingle();
    if (!lesson) return done(ctx, back, { error: "not-found" });
    const { data: last } = await db.from("lesson_resources").select("position").eq("lesson_id", lessonId).order("position", { ascending: false }).limit(1).maybeSingle();
    const position = (last?.position ?? -1) + 1;

    let row: Record<string, unknown>;
    if (intent === "create-file") {
      const path = str(form, "storage_path", 500);
      if (!path.startsWith(`${lesson.course_id}/${lessonId}/`)) return done(ctx, back, { error: "invalid" });
      const fileName = path.split("/").pop()!.replace(/^[0-9a-f-]{36}-/, "");
      const size = Number(str(form, "size_bytes"));
      row = {
        lesson_id: lessonId,
        title: str(form, "title", 200) || fileName,
        kind: kindFor(path),
        storage_path: path,
        size_bytes: Number.isFinite(size) && size > 0 ? size : null,
        position,
      };
    } else {
      const url = str(form, "url", 1000);
      const title = str(form, "title", 200);
      if (!/^https:\/\//i.test(url) || !title) return done(ctx, back, { error: "invalid" });
      row = { lesson_id: lessonId, title, kind: "link", url, position };
    }
    const { error } = await db.from("lesson_resources").insert(row);
    if (error && row.storage_path) await createServiceClient().storage.from("course-media").remove([row.storage_path as string]);
    return done(ctx, back, error ? { error: error.code === "42501" ? "not-allowed" : "failed" } : { notice: "created" });
  }

  const id = str(form, "id");
  if (!isUuid(id)) return done(ctx, back, { error: "invalid" });

  if (intent === "rename") {
    const title = str(form, "title", 200);
    if (!title) return done(ctx, back, { error: "invalid" });
    const { error, count } = await db.from("lesson_resources").update({ title }, { count: "exact" }).eq("id", id);
    return done(ctx, back, error || !count ? { error: error ? "failed" : "not-allowed" } : { notice: "saved" });
  }

  if (intent === "delete") {
    const { data: deleted, error } = await db.from("lesson_resources").delete().eq("id", id).select("storage_path");
    if (error || !deleted?.length) return done(ctx, back, { error: error ? "failed" : "not-allowed" });
    const path = deleted[0]!.storage_path as string | null;
    if (path) await createServiceClient().storage.from("course-media").remove([path]);
    return done(ctx, back, { notice: "deleted" });
  }

  return done(ctx, back, { error: "invalid" });
};
