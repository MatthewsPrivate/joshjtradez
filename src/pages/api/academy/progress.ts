// Lesson progress: playback position (JSON, sent by the player) and completion
// (form button or JSON). RLS only lets students write progress for lessons they
// can open; course_id is derived from the lesson by a trigger.
import type { APIRoute } from "astro";
import { backTo, done, isUuid, json, str } from "../../../lib/academy/forms";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const { request, locals } = ctx;
  const isJson = request.headers.get("content-type")?.includes("application/json");
  let lessonId = "";
  let action = "";
  let position: number | undefined;
  let back = "/academy/student";

  if (isJson) {
    const body = (await request.json().catch(() => ({}))) as { lessonId?: string; action?: string; position?: number };
    lessonId = body.lessonId ?? "";
    action = body.action ?? "";
    position = typeof body.position === "number" && body.position >= 0 ? Math.floor(body.position) : undefined;
  } else {
    const form = await request.formData();
    lessonId = str(form, "lesson_id");
    action = str(form, "action");
    back = backTo(form, back);
  }
  if (!isUuid(lessonId) || !["position", "complete", "incomplete"].includes(action)) {
    return isJson ? json({ error: "invalid" }, 400) : done(ctx, back, { error: "invalid" });
  }

  const row: Record<string, unknown> = { user_id: locals.user!.id, lesson_id: lessonId };
  if (action === "position") row.last_position_seconds = position ?? 0;
  if (action === "complete") row.completed_at = new Date().toISOString();
  if (action === "incomplete") row.completed_at = null;

  const { error } = await locals.supabase.from("lesson_progress").upsert(row, { onConflict: "user_id,lesson_id" });
  if (error) {
    console.error("[progress] save failed:", error.message);
    return isJson ? json({ error: "not-allowed" }, 403) : done(ctx, back, { error: "not-allowed" });
  }
  return isJson ? json({ ok: true }) : done(ctx, back);
};
