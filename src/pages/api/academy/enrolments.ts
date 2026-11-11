// Manual course access (before/alongside payments): grant by email or revoke.
// Requires the enrolments.manage permission (owner, developer, or a permitted
// admin). Writes use the service client after the check, and are audited.
import type { APIRoute } from "astro";
import { audit } from "../../../lib/academy/audit";
import { backTo, done, isUuid, str } from "../../../lib/academy/forms";
import { clientIp } from "../../../lib/academy/http";
import { hasPermission } from "../../../lib/academy/roles";
import { createServiceClient } from "../../../lib/academy/supabase";

export const prerender = false;

async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createServiceClient().auth.admin;
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

export const POST: APIRoute = async (ctx) => {
  const { request, locals } = ctx;
  const form = await request.formData();
  const back = backTo(form, "/academy/teacher/course-builder");
  if (!hasPermission(locals.roles, locals.permissions, "enrolments.manage")) return done(ctx, back, { error: "not-allowed" });

  const svc = createServiceClient();
  const intent = str(form, "intent");

  if (intent === "grant") {
    const courseId = str(form, "course_id");
    const email = str(form, "email", 320);
    if (!isUuid(courseId) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return done(ctx, back, { error: "invalid" });
    const userId = await findUserIdByEmail(email);
    if (!userId) return done(ctx, back, { error: "user-not-found" });
    const { error } = await svc.from("enrolments").upsert(
      { user_id: userId, course_id: courseId, status: "active", source: "manual", granted_by: locals.user!.id, granted_at: new Date().toISOString(), revoked_at: null },
      { onConflict: "user_id,course_id" },
    );
    if (error) return done(ctx, back, { error: "failed" });
    await audit({ actorId: locals.user!.id, action: "enrolment.granted", targetType: "user", targetId: userId, metadata: { course_id: courseId, source: "manual" }, ip: clientIp(request) });
    return done(ctx, back, { notice: "enrolled" });
  }

  if (intent === "revoke") {
    const id = str(form, "id");
    if (!isUuid(id)) return done(ctx, back, { error: "invalid" });
    const { data, error } = await svc
      .from("enrolments")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", id)
      .select("user_id, course_id")
      .maybeSingle();
    if (error || !data) return done(ctx, back, { error: "failed" });
    await audit({ actorId: locals.user!.id, action: "enrolment.revoked", targetType: "user", targetId: data.user_id, metadata: { course_id: data.course_id }, ip: clientIp(request) });
    return done(ctx, back, { notice: "access-removed" });
  }

  return done(ctx, back, { error: "invalid" });
};
