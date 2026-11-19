// "Who needs attention?" — builds the student roster for Josh / teachers and
// flags students at risk of dropping off, from real activity only:
//   last active (portal visits, sign-ins, lesson activity), lesson progress,
//   trades the student has chosen to share, and trade reviews left waiting.
// Private journal trades are never read here — RLS only returns shared ones.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission, type Role, type StaffPermission } from "./roles";

const DAY = 864e5;

export type RiskLevel = "high" | "medium" | "ok" | "completed" | "lead";

export interface RiskFlag {
  level: "high" | "medium" | "action";
  text: string;
}

export interface StudentCourse {
  id: string;
  title: string;
  slug: string;
  completed: number;
  total: number;
}

export interface StudentRisk {
  id: string;
  name: string;
  email: string | null;
  joinedAt: string | null;
  enrolledAt: string | null;
  lastActiveAt: string | null;
  daysInactive: number | null;
  courses: StudentCourse[];
  completed: number;
  total: number;
  pct: number | null;
  lessonsLast14: number;
  stuckLesson: string | null;
  reviewsWaiting: number;
  oldestReviewAt: string | null;
  level: RiskLevel;
  flags: RiskFlag[];
}

export interface Viewer {
  id: string;
  roles: readonly Role[];
  permissions: readonly StaffPermission[];
}

interface Contact {
  id: string;
  email: string | null;
  last_sign_in_at: string | null;
  last_seen_at: string | null;
  joined_at: string | null;
  is_staff: boolean;
}

const maxIso = (...xs: (string | null | undefined)[]) => xs.filter((x): x is string => !!x).sort().at(-1) ?? null;
const days = (iso: string | null, now: number) => (iso ? Math.floor((now - new Date(iso).getTime()) / DAY) : null);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export async function loadStudentRoster(supabase: SupabaseClient, viewer: Viewer): Promise<StudentRisk[]> {
  const seesAll = hasPermission(viewer.roles, viewer.permissions, "students.read");
  const now = Date.now();

  // 1. Which courses and enrolments are in scope.
  let courseIds: string[] | null = null;
  if (!seesAll) {
    const { data } = await supabase.from("course_teachers").select("course_id").eq("teacher_id", viewer.id);
    courseIds = (data ?? []).map((r) => r.course_id as string);
    if (!courseIds.length) return [];
  }
  let enrolQ = supabase.from("enrolments").select("user_id, course_id, granted_at").eq("status", "active").limit(20000);
  if (courseIds) enrolQ = enrolQ.in("course_id", courseIds);
  const [enrolRes, leadRes] = await Promise.all([enrolQ, seesAll ? supabase.rpc("student_ids") : Promise.resolve({ data: [] as string[] })]);
  const enrolments = (enrolRes.data ?? []) as { user_id: string; course_id: string; granted_at: string }[];
  const leadIds = ((leadRes.data ?? []) as (string | { student_ids: string })[]).map((r) => (typeof r === "string" ? r : r.student_ids));

  const ids = [...new Set([...enrolments.map((e) => e.user_id), ...leadIds])].filter((id) => id !== viewer.id);
  if (!ids.length) return [];
  const enrolledCourseIds = [...new Set(enrolments.map((e) => e.course_id))];

  // 2. Everything else in parallel. RLS scopes each query to what the viewer may see.
  const [contactsRes, peopleRes, courseRes, cpRes, lpRes, tradeRes] = await Promise.all([
    supabase.rpc("student_contacts", { ids }),
    supabase.from("member_directory").select("id, name").in("id", ids),
    enrolledCourseIds.length ? supabase.from("courses").select("id, title, slug").in("id", enrolledCourseIds) : Promise.resolve({ data: [] }),
    enrolledCourseIds.length ? supabase.from("course_progress").select("user_id, course_id, total_lessons, completed_lessons, last_activity_at").in("user_id", ids) : Promise.resolve({ data: [] }),
    supabase.from("lesson_progress").select("user_id, lesson_id, completed_at, updated_at").in("user_id", ids).order("updated_at", { ascending: false }).limit(20000),
    supabase
      .from("trades")
      .select("user_id, r_multiple, pnl, exit_price, entry_at, review_requested_at, reviewed_at")
      .in("user_id", ids)
      .order("entry_at", { ascending: false })
      .limit(5000),
  ]);
  if (contactsRes.error) console.error("[students] contacts failed:", contactsRes.error.message);

  const contacts = new Map(((contactsRes.data ?? []) as Contact[]).map((c) => [c.id, c]));
  const names = new Map((peopleRes.data ?? []).map((p) => [p.id as string, p.name as string]));
  const courses = new Map(((courseRes.data ?? []) as { id: string; title: string; slug: string }[]).map((c) => [c.id, c]));
  const cp = (cpRes.data ?? []) as { user_id: string; course_id: string; total_lessons: number; completed_lessons: number; last_activity_at: string | null }[];
  const lp = (lpRes.data ?? []) as { user_id: string; lesson_id: string; completed_at: string | null; updated_at: string }[];
  const trades = (tradeRes.data ?? []) as { user_id: string; r_multiple: number | string | null; pnl: number | string | null; exit_price: unknown; entry_at: string; review_requested_at: string | null; reviewed_at: string | null }[];

  // The lesson each student touched most recently, if they didn't finish it.
  const stuckLessonId = new Map<string, string>();
  const latestLp = new Map<string, string>();
  for (const row of lp) {
    if (latestLp.has(row.user_id)) continue; // rows are newest first
    latestLp.set(row.user_id, row.updated_at);
    if (!row.completed_at) stuckLessonId.set(row.user_id, row.lesson_id);
  }
  const stuckIds = [...new Set(stuckLessonId.values())];
  const { data: lessonRows } = stuckIds.length ? await supabase.from("lessons").select("id, title").in("id", stuckIds) : { data: [] };
  const lessonTitle = new Map((lessonRows ?? []).map((l) => [l.id as string, l.title as string]));

  const since14 = new Date(now - 14 * DAY).toISOString();
  const roster: StudentRisk[] = [];

  for (const id of ids) {
    const c = contacts.get(id);
    if (!c || c.is_staff) continue; // not visible to this viewer, or a staff/developer account
    const mine = enrolments.filter((e) => e.user_id === id);
    const enrolledAt = mine.map((e) => e.granted_at).sort()[0] ?? null;
    const progress = cp.filter((p) => p.user_id === id);
    const myCourses: StudentCourse[] = mine
      .map((e) => {
        const course = courses.get(e.course_id);
        const p = progress.find((x) => x.course_id === e.course_id);
        return course ? { id: course.id, title: course.title, slug: course.slug, completed: p?.completed_lessons ?? 0, total: p?.total_lessons ?? 0 } : null;
      })
      .filter((x): x is StudentCourse => !!x);
    const completed = myCourses.reduce((a, x) => a + x.completed, 0);
    const total = myCourses.reduce((a, x) => a + x.total, 0);
    const myLp = lp.filter((r) => r.user_id === id);
    const lessonsLast14 = myLp.filter((r) => r.completed_at && r.completed_at >= since14).length;
    const myTrades = trades.filter((t) => t.user_id === id);
    const waiting = myTrades.filter((t) => t.review_requested_at && !(t.reviewed_at && t.reviewed_at >= t.review_requested_at));
    const oldestReviewAt = waiting.map((t) => t.review_requested_at!).sort()[0] ?? null;

    const lastActiveAt = maxIso(c.last_seen_at, c.last_sign_in_at, latestLp.get(id), myTrades[0]?.entry_at);
    const daysInactive = days(lastActiveAt ?? enrolledAt ?? c.joined_at, now);
    const enrolledDays = days(enrolledAt, now);
    const flags: RiskFlag[] = [];

    if (mine.length) {
      if (daysInactive !== null && daysInactive >= 14) flags.push({ level: "high", text: `Inactive for ${plural(daysInactive, "day")}` });
      else if (daysInactive !== null && daysInactive >= 7) flags.push({ level: "medium", text: `Inactive for ${plural(daysInactive, "day")}` });

      if (myLp.length === 0 && enrolledDays !== null && enrolledDays >= 3) {
        flags.push({ level: enrolledDays >= 10 ? "high" : "medium", text: `Hasn't started — enrolled ${plural(enrolledDays, "day")} ago` });
      } else if (myLp.length > 0 && total > 0 && completed < total && lessonsLast14 === 0 && (enrolledDays ?? 0) >= 14) {
        flags.push({ level: "medium", text: "No lessons completed in 2 weeks" });
      }

      // Trading signals — shared trades only.
      const closed = myTrades.filter((t) => t.exit_price !== null || t.pnl !== null).slice(0, 10);
      const result = (t: (typeof closed)[number]) => Number(t.pnl ?? t.r_multiple ?? 0);
      let streak = 0;
      for (const t of closed) {
        if (result(t) < 0) streak++;
        else break;
      }
      const last10R = closed.reduce((a, t) => a + Number(t.r_multiple ?? 0), 0);
      if (streak >= 4) flags.push({ level: "medium", text: `${streak} losing trades in a row` });
      else if (closed.length >= 5 && last10R <= -3) flags.push({ level: "medium", text: `${last10R.toFixed(1)}R over last ${closed.length} shared trades` });
    }

    const reviewAge = days(oldestReviewAt, now);
    if (waiting.length) {
      flags.push({ level: "action", text: `${plural(waiting.length, "trade")} waiting for your review${reviewAge && reviewAge >= 1 ? ` (${plural(reviewAge, "day")})` : ""}` });
    }

    const level: RiskLevel = !mine.length
      ? "lead"
      : flags.some((f) => f.level === "high")
        ? "high"
        : flags.some((f) => f.level === "medium") || (reviewAge ?? 0) >= 2
          ? "medium"
          : total > 0 && completed >= total
            ? "completed"
            : "ok";

    roster.push({
      id,
      name: names.get(id) ?? c.email?.split("@")[0] ?? "Student",
      email: c.email,
      joinedAt: c.joined_at,
      enrolledAt,
      lastActiveAt,
      daysInactive,
      courses: myCourses,
      completed,
      total,
      pct: total ? (completed / total) * 100 : null,
      lessonsLast14,
      stuckLesson: stuckLessonId.has(id) ? (lessonTitle.get(stuckLessonId.get(id)!) ?? null) : null,
      reviewsWaiting: waiting.length,
      oldestReviewAt,
      level,
      flags,
    });
  }

  const rank: Record<RiskLevel, number> = { high: 0, medium: 1, ok: 2, completed: 3, lead: 4 };
  return roster.sort((a, b) => rank[a.level] - rank[b.level] || (b.daysInactive ?? 0) - (a.daysInactive ?? 0) || a.name.localeCompare(b.name));
}

export const needsAttention = (s: StudentRisk) => s.level === "high" || s.level === "medium" || s.reviewsWaiting > 0;

export function lastActiveLabel(s: Pick<StudentRisk, "lastActiveAt" | "daysInactive">): string {
  if (!s.lastActiveAt) return "Never";
  const d = s.daysInactive ?? 0;
  if (d === 0) {
    const h = Math.floor((Date.now() - new Date(s.lastActiveAt).getTime()) / 36e5);
    return h < 1 ? "Just now" : `${h}h ago`;
  }
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

/** Compact summary for the overview pages. */
export interface Attention {
  atRisk: StudentRisk[];
  atRiskCount: number;
  reviewsWaiting: number;
  oldestReviewAt: string | null;
}

export async function loadAttention(supabase: SupabaseClient, viewer: Viewer): Promise<Attention> {
  const roster = await loadStudentRoster(supabase, viewer);
  const flagged = roster.filter((s) => s.level === "high" || s.level === "medium");
  return {
    atRisk: flagged.slice(0, 5),
    atRiskCount: flagged.length,
    reviewsWaiting: roster.reduce((a, s) => a + s.reviewsWaiting, 0),
    oldestReviewAt: roster.map((s) => s.oldestReviewAt).filter((x): x is string => !!x).sort()[0] ?? null,
  };
}
