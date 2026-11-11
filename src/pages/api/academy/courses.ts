// Course create / update / cover / delete. Writes go through the user's client,
// so RLS decides who may manage which course.
import type { APIRoute } from "astro";
import { audit } from "../../../lib/academy/audit";
import { LEVELS, slugify } from "../../../lib/academy/courses";
import { backTo, bool, done, int, isUuid, optStr, str } from "../../../lib/academy/forms";
import { clientIp } from "../../../lib/academy/http";
import { createServiceClient } from "../../../lib/academy/supabase";

export const prerender = false;

const BUILDER = "/academy/teacher/course-builder";
const STATUSES = new Set(["draft", "published", "archived"]);

export const POST: APIRoute = async (ctx) => {
  const { request, locals } = ctx;
  const form = await request.formData();
  const intent = str(form, "intent");
  const id = str(form, "id");
  const back = backTo(form, id ? `${BUILDER}/${id}` : BUILDER);
  const db = locals.supabase;

  if (intent === "create") {
    const title = str(form, "title", 200);
    if (title.length < 3) return done(ctx, back, { error: "invalid" });
    let slug = slugify(title);
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data, error } = await db.from("courses").insert({ title, slug }).select("id").single();
      if (!error) {
        await audit({ actorId: locals.user!.id, action: "course.created", targetType: "course", targetId: data.id, ip: clientIp(request) });
        return done(ctx, `${BUILDER}/${data.id}`, { notice: "created" });
      }
      if (error.code !== "23505") {
        console.error("[courses] create failed:", error.message);
        return done(ctx, back, { error: error.code === "42501" ? "not-allowed" : "failed" });
      }
      slug = `${slugify(title).slice(0, 54)}-${Math.random().toString(36).slice(2, 6)}`;
    }
    return done(ctx, back, { error: "failed" });
  }

  if (!isUuid(id)) return done(ctx, BUILDER, { error: "invalid" });

  if (intent === "update") {
    const title = str(form, "title", 200);
    const slug = slugify(str(form, "slug", 80) || title);
    const status = str(form, "status");
    const level = str(form, "level");
    const lessonsPct = int(form, "lessons_pct", 0, 100);
    const minAssessment = int(form, "min_assessment_pct", 0, 100);
    if (title.length < 3 || !STATUSES.has(status)) return done(ctx, back, { error: "invalid" });

    const { error, count } = await db
      .from("courses")
      .update(
        {
          title,
          slug,
          summary: str(form, "summary", 400),
          description: str(form, "description", 20_000),
          level: (LEVELS as readonly string[]).includes(level) ? level : null,
          category: optStr(form, "category", 60),
          status,
          is_featured: bool(form, "is_featured"),
          completion_rule: { lessons_pct: lessonsPct ?? 100, min_assessment_pct: minAssessment },
        },
        { count: "exact" },
      )
      .eq("id", id);
    if (error) return done(ctx, back, { error: error.code === "23505" ? "slug-taken" : "failed" });
    if (!count) return done(ctx, back, { error: "not-allowed" });
    await audit({ actorId: locals.user!.id, action: "course.updated", targetType: "course", targetId: id, metadata: { status }, ip: clientIp(request) });
    return done(ctx, back, { notice: status === "published" ? "published" : "saved" });
  }

  if (intent === "set-cover" || intent === "clear-cover") {
    const path = intent === "set-cover" ? str(form, "storage_path", 500) : null;
    if (path !== null && !path.startsWith(`${id}/`)) return done(ctx, back, { error: "invalid" });
    const { data: before } = await db.from("courses").select("cover_path").eq("id", id).maybeSingle();
    const { error, count } = await db.from("courses").update({ cover_path: path }, { count: "exact" }).eq("id", id);
    if (error || !count) return done(ctx, back, { error: error ? "failed" : "not-allowed" });
    if (before?.cover_path && before.cover_path !== path) {
      await createServiceClient().storage.from("course-covers").remove([before.cover_path]);
    }
    return done(ctx, back, { notice: "saved" });
  }

  if (intent === "delete") {
    const { count: enrolled } = await createServiceClient()
      .from("enrolments")
      .select("id", { count: "exact", head: true })
      .eq("course_id", id);
    if (enrolled) return done(ctx, back, { error: "has-enrolments" });
    const { data: course } = await db.from("courses").select("title").eq("id", id).maybeSingle();
    const { error, count } = await db.from("courses").delete({ count: "exact" }).eq("id", id);
    if (error || !count) return done(ctx, back, { error: error ? "failed" : "not-allowed" });
    // Remove this course's uploaded files.
    const svc = createServiceClient();
    for (const bucket of ["course-media", "course-covers"]) {
      const { data: files } = await svc.storage.from(bucket).list(id, { limit: 1000 });
      const paths: string[] = [];
      for (const f of files ?? []) {
        if (f.id) paths.push(`${id}/${f.name}`);
        else {
          const { data: inner } = await svc.storage.from(bucket).list(`${id}/${f.name}`, { limit: 1000 });
          paths.push(...(inner ?? []).map((g) => `${id}/${f.name}/${g.name}`));
        }
      }
      if (paths.length) await svc.storage.from(bucket).remove(paths);
    }
    await audit({ actorId: locals.user!.id, action: "course.deleted", targetType: "course", targetId: id, metadata: { title: course?.title }, ip: clientIp(request) });
    return done(ctx, BUILDER, { notice: "deleted" });
  }

  return done(ctx, back, { error: "invalid" });
};
