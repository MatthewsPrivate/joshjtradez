// Serves private course media (lesson videos and resources). Checks, as the
// signed-in user, that the file belongs to a lesson they may open (RLS covers
// enrolment, free previews and course managers), then redirects to a
// short-lived signed URL.
import type { APIRoute } from "astro";
import { isUuid } from "../../../lib/academy/forms";
import { createServiceClient } from "../../../lib/academy/supabase";

export const prerender = false;

const TTL_SECONDS = 4 * 60 * 60; // long enough to finish watching a lesson

export const GET: APIRoute = async ({ url, locals }) => {
  const path = url.searchParams.get("p") ?? "";
  const [courseId, lessonId] = path.split("/");
  if (!courseId || !lessonId || !isUuid(courseId) || !isUuid(lessonId) || path.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const [lessonRes, resourceRes] = await Promise.all([
    locals.supabase.from("lessons").select("id").eq("id", lessonId).eq("course_id", courseId).eq("video_path", path).maybeSingle(),
    locals.supabase.from("lesson_resources").select("title").eq("lesson_id", lessonId).eq("storage_path", path).maybeSingle(),
  ]);
  if (!lessonRes.data && !resourceRes.data) return new Response("Not found", { status: 404 });

  const download = url.searchParams.get("download");
  const { data, error } = await createServiceClient()
    .storage.from("course-media")
    .createSignedUrl(path, TTL_SECONDS, download ? { download: download.slice(0, 120) } : undefined);
  if (error || !data) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 302, headers: { location: data.signedUrl, "cache-control": "private, no-store" } });
};
