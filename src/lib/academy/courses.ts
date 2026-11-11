// Course catalogue / curriculum loaders. All reads use the caller's RLS-scoped
// client: students only receive lessons they may open (enrolled or preview),
// managers receive drafts too.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission, type Role, type StaffPermission } from "./roles";

export interface CourseRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  level: string | null;
  category: string | null;
  cover_path: string | null;
  status: "draft" | "published" | "archived";
  is_featured: boolean;
  completion_rule: { lessons_pct?: number; min_assessment_pct?: number | null };
  created_at: string;
  updated_at: string;
}

export interface LessonRow {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  summary: string;
  body: { markdown?: string };
  video_path: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  position: number;
  is_preview: boolean;
  status: "draft" | "published" | "archived";
}

export interface ResourceRow {
  id: string;
  lesson_id: string;
  title: string;
  kind: "pdf" | "image" | "video" | "file" | "link";
  storage_path: string | null;
  url: string | null;
  size_bytes: number | null;
  position: number;
}

export interface ModuleTree {
  id: string;
  course_id: string;
  title: string;
  summary: string;
  position: number;
  lessons: LessonRow[];
}

export interface CourseTree {
  course: CourseRow;
  modules: ModuleTree[];
  /** Flattened in curriculum order. */
  lessons: LessonRow[];
  instructor: string | null;
}

export const COURSE_COLUMNS =
  "id, slug, title, summary, description, level, category, cover_path, status, is_featured, completion_rule, created_at, updated_at";
const LESSON_COLUMNS =
  "id, module_id, course_id, title, summary, body, video_path, video_url, duration_seconds, position, is_preview, status";

export function coverUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = import.meta.env.PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  return base ? `${base}/storage/v1/object/public/course-covers/${path.split("/").map(encodeURIComponent).join("/")}` : null;
}

export function mediaUrl(path: string, download?: string): string {
  const q = new URLSearchParams({ p: path });
  if (download) q.set("download", download);
  return `/api/academy/media?${q}`;
}

export async function loadCourseTree(
  supabase: SupabaseClient,
  by: { slug: string } | { id: string },
): Promise<CourseTree | null> {
  const q = supabase.from("courses").select(COURSE_COLUMNS);
  const { data: course } = await ("slug" in by ? q.eq("slug", by.slug) : q.eq("id", by.id)).maybeSingle<CourseRow>();
  if (!course) return null;

  const [modulesRes, lessonsRes, teachersRes] = await Promise.all([
    supabase.from("modules").select("id, course_id, title, summary, position").eq("course_id", course.id).order("position"),
    supabase.from("lessons").select(LESSON_COLUMNS).eq("course_id", course.id).order("position"),
    supabase.from("course_teachers").select("teacher_id, is_lead").eq("course_id", course.id),
  ]);

  const lessonsByModule = new Map<string, LessonRow[]>();
  for (const l of (lessonsRes.data ?? []) as LessonRow[]) {
    lessonsByModule.set(l.module_id, [...(lessonsByModule.get(l.module_id) ?? []), l]);
  }
  const modules: ModuleTree[] = ((modulesRes.data ?? []) as Omit<ModuleTree, "lessons">[]).map((m) => ({
    ...m,
    lessons: lessonsByModule.get(m.id) ?? [],
  }));

  const teachers = (teachersRes.data ?? []) as { teacher_id: string; is_lead: boolean }[];
  const lead = teachers.find((t) => t.is_lead) ?? teachers[0];
  let instructor: string | null = null;
  if (lead) {
    const { data } = await supabase.from("member_directory").select("name").eq("id", lead.teacher_id).maybeSingle();
    instructor = (data?.name as string | undefined) ?? null;
  }

  return { course, modules, lessons: modules.flatMap((m) => m.lessons), instructor };
}

/** Courses the user can edit: all for course managers, otherwise those they teach. */
export async function loadManageableCourses(
  supabase: SupabaseClient,
  userId: string,
  roles: Role[],
  permissions: StaffPermission[],
): Promise<CourseRow[]> {
  let query = supabase.from("courses").select(COURSE_COLUMNS).order("updated_at", { ascending: false });
  if (!hasPermission(roles, permissions, "courses.manage")) {
    const { data } = await supabase.from("course_teachers").select("course_id").eq("teacher_id", userId);
    const ids = (data ?? []).map((r) => r.course_id as string);
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  }
  const { data } = await query;
  return (data ?? []) as CourseRow[];
}

export interface ProgressMap {
  completed: Set<string>;
  positions: Map<string, number>;
  lastLessonId: string | null;
}

export async function loadProgress(supabase: SupabaseClient, userId: string, courseId: string): Promise<ProgressMap> {
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed_at, last_position_seconds, updated_at")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as { lesson_id: string; completed_at: string | null; last_position_seconds: number }[];
  return {
    completed: new Set(rows.filter((r) => r.completed_at).map((r) => r.lesson_id)),
    positions: new Map(rows.map((r) => [r.lesson_id, r.last_position_seconds])),
    lastLessonId: rows[0]?.lesson_id ?? null,
  };
}

/** Lesson a student should open next: first incomplete after their latest activity, else first incomplete. */
export function resumeLesson(lessons: LessonRow[], progress: ProgressMap): LessonRow | null {
  const playable = lessons.filter((l) => l.status === "published");
  if (playable.length === 0) return null;
  if (progress.lastLessonId) {
    const i = playable.findIndex((l) => l.id === progress.lastLessonId);
    if (i >= 0 && !progress.completed.has(playable[i]!.id)) return playable[i]!;
    const after = playable.slice(i + 1).find((l) => !progress.completed.has(l.id));
    if (after) return after;
  }
  return playable.find((l) => !progress.completed.has(l.id)) ?? playable[0]!;
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "course"
  );
}

export const LEVELS = ["Foundation", "Intermediate", "Advanced"] as const;
