// Issues a one-time signed upload URL so the browser can send a file straight
// to Supabase Storage (large videos never pass through our server). The caller
// must be able to manage the course; the object path is chosen here, not by
// the client.
import type { APIRoute } from "astro";
import { isUuid, json } from "../../../../lib/academy/forms";
import { createServiceClient } from "../../../../lib/academy/supabase";

export const prerender = false;

const ALLOWED: Record<string, RegExp> = {
  "course-covers": /^image\/(png|jpe?g|webp|gif)$/,
  "course-media":
    /^(video\/(mp4|quicktime|webm|x-m4v)|image\/(png|jpe?g|webp|gif|svg\+xml)|application\/(pdf|zip|vnd\.openxmlformats-officedocument\.[a-z.]+|vnd\.ms-(excel|powerpoint)|msword)|text\/(plain|csv))$/,
};

const safeName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-100) || "file";

export const POST: APIRoute = async ({ request, locals }) => {
  let body: { bucket?: string; courseId?: string; lessonId?: string; filename?: string; contentType?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid" }, 400);
  }
  const { bucket = "", courseId = "", lessonId, filename = "", contentType = "" } = body;
  const pattern = ALLOWED[bucket];
  if (!pattern || !isUuid(courseId) || !filename) return json({ error: "invalid" }, 400);
  if (!pattern.test(contentType)) return json({ error: "unsupported-type" }, 415);
  if (bucket === "course-media" && !(lessonId && isUuid(lessonId))) return json({ error: "invalid" }, 400);

  // Authorise as the signed-in user (RLS-aware function).
  const { data: allowed, error } = await locals.supabase.rpc("can_manage_course", { c: courseId });
  if (error || allowed !== true) return json({ error: "not-allowed" }, 403);
  if (lessonId) {
    const { data: lesson } = await locals.supabase.from("lessons").select("id").eq("id", lessonId).eq("course_id", courseId).maybeSingle();
    if (!lesson) return json({ error: "not-found" }, 404);
  }

  const path = [courseId, lessonId, `${crypto.randomUUID()}-${safeName(filename)}`].filter(Boolean).join("/");
  const { data, error: signError } = await createServiceClient().storage.from(bucket).createSignedUploadUrl(path);
  if (signError || !data) {
    console.error("[uploads] sign failed:", signError?.message);
    return json({ error: "failed" }, 500);
  }
  return json({ signedUrl: data.signedUrl, path });
};
