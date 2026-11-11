// Overview-page data, loaded per request with the signed-in user's client so
// every query is subject to RLS. Features whose tables don't exist yet
// (assessments, live classes, support) are reported as null, and the UI shows
// an empty state rather than invented numbers.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission, type Role, type StaffPermission } from "./roles";

export const TIME_ZONE = "Europe/London";
const WEEKLY_LESSON_GOAL = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export interface MonthBucket {
  key: string; // "2026-11"
  label: string; // "Nov"
  start: Date;
}

export function lastTwelveMonths(now = new Date()): MonthBucket[] {
  return Array.from({ length: 12 }, (_, i) => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 1));
    return {
      key: start.toISOString().slice(0, 7),
      label: start.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }),
      start,
    };
  });
}

function bucketise<T>(rows: T[], months: MonthBucket[], date: (r: T) => string | null, value: (r: T) => number): number[] {
  const totals = new Map(months.map((m) => [m.key, 0]));
  for (const r of rows) {
    const d = date(r);
    if (!d) continue;
    const key = d.slice(0, 7);
    if (totals.has(key)) totals.set(key, totals.get(key)! + value(r));
  }
  return months.map((m) => totals.get(m.key)!);
}

/** "+12.4%" / "-3.0%", or null when there's no baseline to compare against. */
export function pctChange(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function formatMoney(minor: number, currency = "GBP", compact = false): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(minor / 100);
}

export const formatInt = (n: number) => new Intl.NumberFormat("en-GB").format(n);

function startOfWeekUTC(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

function startOfMonthUTC(now = new Date(), offset = 0): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
}

interface ProgressRow {
  user_id: string;
  course_id: string;
  total_lessons: number;
  completed_lessons: number;
  last_activity_at: string | null;
}

const completionPct = (r: Pick<ProgressRow, "total_lessons" | "completed_lessons">) =>
  r.total_lessons > 0 ? (r.completed_lessons / r.total_lessons) * 100 : 0;

function averageCompletion(rows: ProgressRow[]): number | null {
  const withLessons = rows.filter((r) => r.total_lessons > 0);
  if (withLessons.length === 0) return null;
  return withLessons.reduce((s, r) => s + completionPct(r), 0) / withLessons.length;
}

async function profileNames(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, full_name, display_name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id as string, (p.display_name || p.full_name || "Unnamed") as string]));
}

function throwIf(error: { message: string } | null, what: string) {
  if (error) throw new Error(`[dashboard] ${what}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------
export interface StudentCourseCard {
  id: string;
  slug: string;
  title: string;
  level: string | null;
  instructor: string | null;
  modules: number;
  progress: number;
  completedLessons: number;
  totalLessons: number;
}

export interface StudentOverview {
  coursesActive: number;
  coursesAddedThisMonth: number;
  learningHours: number;
  hoursByMonth: number[];
  hoursChange: string | null;
  lessonsThisWeek: number;
  weeklyGoal: number;
  courses: StudentCourseCard[];
  months: MonthBucket[];
}

export async function loadStudentOverview(supabase: SupabaseClient, userId: string): Promise<StudentOverview> {
  const months = lastTwelveMonths();
  const [enrolRes, progRes, doneRes] = await Promise.all([
    supabase
      .from("enrolments")
      .select("course_id, granted_at, courses(id, slug, title, level)")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase.from("course_progress").select("*").eq("user_id", userId),
    supabase
      .from("lesson_progress")
      .select("completed_at, lessons(duration_seconds)")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
  ]);
  throwIf(enrolRes.error, "enrolments");
  throwIf(progRes.error, "course_progress");
  throwIf(doneRes.error, "lesson_progress");

  const enrolments = (enrolRes.data ?? []) as unknown as {
    course_id: string;
    granted_at: string;
    courses: { id: string; slug: string; title: string; level: string | null } | null;
  }[];
  const progress = new Map(((progRes.data ?? []) as ProgressRow[]).map((p) => [p.course_id, p]));
  const completions = (doneRes.data ?? []) as unknown as {
    completed_at: string;
    lessons: { duration_seconds: number | null } | null;
  }[];

  const courseIds = enrolments.map((e) => e.course_id);
  const [modulesRes, leadsRes] = await Promise.all([
    courseIds.length
      ? supabase.from("modules").select("course_id").in("course_id", courseIds)
      : Promise.resolve({ data: [], error: null }),
    courseIds.length
      ? supabase.from("course_teachers").select("course_id, teacher_id, is_lead").in("course_id", courseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const moduleCounts = new Map<string, number>();
  for (const m of (modulesRes.data ?? []) as { course_id: string }[]) {
    moduleCounts.set(m.course_id, (moduleCounts.get(m.course_id) ?? 0) + 1);
  }
  const leads = new Map<string, string>();
  for (const t of (leadsRes.data ?? []) as { course_id: string; teacher_id: string; is_lead: boolean }[]) {
    if (t.is_lead || !leads.has(t.course_id)) leads.set(t.course_id, t.teacher_id);
  }
  const names = await profileNames(supabase, [...new Set(leads.values())]);

  const courses: StudentCourseCard[] = enrolments
    .filter((e) => e.courses)
    .map((e) => {
      const p = progress.get(e.course_id);
      return {
        id: e.course_id,
        slug: e.courses!.slug,
        title: e.courses!.title,
        level: e.courses!.level,
        instructor: names.get(leads.get(e.course_id) ?? "") ?? null,
        modules: moduleCounts.get(e.course_id) ?? 0,
        progress: p ? completionPct(p) : 0,
        completedLessons: p?.completed_lessons ?? 0,
        totalLessons: p?.total_lessons ?? 0,
        lastActivity: p?.last_activity_at ?? e.granted_at,
      };
    })
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
    .map(({ lastActivity: _, ...c }) => c);

  const hoursByMonth = bucketise(completions, months, (r) => r.completed_at, (r) => (r.lessons?.duration_seconds ?? 0) / 3600);
  const learningHours = completions.reduce((s, r) => s + (r.lessons?.duration_seconds ?? 0), 0) / 3600;
  const weekStart = startOfWeekUTC().toISOString();
  const monthStart = startOfMonthUTC().toISOString();

  return {
    coursesActive: courses.length,
    coursesAddedThisMonth: enrolments.filter((e) => e.granted_at >= monthStart).length,
    learningHours,
    hoursByMonth,
    hoursChange: pctChange(hoursByMonth[11]!, hoursByMonth[10]!),
    lessonsThisWeek: completions.filter((c) => c.completed_at >= weekStart).length,
    weeklyGoal: WEEKLY_LESSON_GOAL,
    courses,
    months,
  };
}

// ---------------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------------
export interface TeacherOverview {
  coursesTaught: number;
  assignedStudents: number;
  newStudentsThisMonth: number;
  avgCompletion: number | null;
  completionsByMonth: number[];
  months: MonthBucket[];
}

export async function loadTeacherOverview(supabase: SupabaseClient, userId: string): Promise<TeacherOverview> {
  const months = lastTwelveMonths();
  const taughtRes = await supabase.from("course_teachers").select("course_id").eq("teacher_id", userId);
  throwIf(taughtRes.error, "course_teachers");
  const courseIds = (taughtRes.data ?? []).map((r) => r.course_id as string);
  if (courseIds.length === 0) {
    return { coursesTaught: 0, assignedStudents: 0, newStudentsThisMonth: 0, avgCompletion: null, completionsByMonth: months.map(() => 0), months };
  }

  const since = months[0]!.start.toISOString();
  const [enrolRes, progRes, doneRes] = await Promise.all([
    supabase.from("enrolments").select("user_id, granted_at").in("course_id", courseIds).eq("status", "active"),
    supabase.from("course_progress").select("*").in("course_id", courseIds),
    supabase.from("lesson_progress").select("completed_at").in("course_id", courseIds).gte("completed_at", since),
  ]);
  throwIf(enrolRes.error, "enrolments");
  throwIf(progRes.error, "course_progress");
  throwIf(doneRes.error, "lesson_progress");

  const enrolments = (enrolRes.data ?? []) as { user_id: string; granted_at: string }[];
  const monthStart = startOfMonthUTC().toISOString();
  return {
    coursesTaught: courseIds.length,
    assignedStudents: new Set(enrolments.map((e) => e.user_id)).size,
    newStudentsThisMonth: new Set(enrolments.filter((e) => e.granted_at >= monthStart).map((e) => e.user_id)).size,
    avgCompletion: averageCompletion((progRes.data ?? []) as ProgressRow[]),
    completionsByMonth: bucketise((doneRes.data ?? []) as { completed_at: string }[], months, (r) => r.completed_at, () => 1),
    months,
  };
}

// ---------------------------------------------------------------------------
// Owner
// ---------------------------------------------------------------------------
export interface OrderRow {
  id: string;
  amount_minor: number;
  refunded_minor: number;
  currency: string;
  status: string;
  provider_reference: string | null;
  created_at: string;
  productName: string;
}

export interface OwnerOverview {
  totalRevenueMinor: number;
  monthRevenueMinor: number;
  monthRevenueChange: string | null;
  revenueByMonth: number[];
  revenueChange12m: string | null;
  activeStudents: number;
  avgCompletion: number | null;
  latestOrders: OrderRow[];
  /** Website contact-form enquiries not yet contacted (newest first, max 3). */
  newEnquiries: { id: string; name: string; created_at: string; experience: string | null }[];
  newEnquiryCount: number;
  months: MonthBucket[];
  currency: string;
}

const COUNTS_AS_REVENUE = new Set(["paid", "partially_refunded", "refunded"]);
const netMinor = (o: { amount_minor: number; refunded_minor: number }) => o.amount_minor - o.refunded_minor;

export async function loadOwnerOverview(supabase: SupabaseClient): Promise<OwnerOverview> {
  const months = lastTwelveMonths();
  const [ordersRes, latestRes, enrolRes, progRes, enquiriesRes] = await Promise.all([
    supabase.from("orders").select("amount_minor, refunded_minor, currency, status, created_at").in("status", [...COUNTS_AS_REVENUE]),
    supabase
      .from("orders")
      .select("id, amount_minor, refunded_minor, currency, status, provider_reference, created_at, products(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("enrolments").select("user_id").eq("status", "active"),
    supabase.from("course_progress").select("*"),
    supabase
      .from("contact_submissions")
      .select("id, name, created_at, answers", { count: "exact" })
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  throwIf(ordersRes.error, "orders");
  throwIf(latestRes.error, "latest orders");
  throwIf(enrolRes.error, "enrolments");
  throwIf(progRes.error, "course_progress");

  const orders = (ordersRes.data ?? []) as { amount_minor: number; refunded_minor: number; currency: string; created_at: string }[];
  const revenueByMonth = bucketise(orders, months, (o) => o.created_at, netMinor);
  const prior12Start = new Date(months[0]!.start);
  prior12Start.setUTCFullYear(prior12Start.getUTCFullYear() - 1);
  const prior12 = orders
    .filter((o) => o.created_at >= prior12Start.toISOString() && o.created_at < months[0]!.start.toISOString())
    .reduce((s, o) => s + netMinor(o), 0);
  const last12 = revenueByMonth.reduce((a, b) => a + b, 0);

  return {
    totalRevenueMinor: orders.reduce((s, o) => s + netMinor(o), 0),
    monthRevenueMinor: revenueByMonth[11]!,
    monthRevenueChange: pctChange(revenueByMonth[11]!, revenueByMonth[10]!),
    revenueByMonth,
    revenueChange12m: pctChange(last12, prior12),
    activeStudents: new Set((enrolRes.data ?? []).map((e) => e.user_id as string)).size,
    avgCompletion: averageCompletion((progRes.data ?? []) as ProgressRow[]),
    latestOrders: ((latestRes.data ?? []) as unknown as (Omit<OrderRow, "productName"> & { products: { name: string } | null })[]).map(
      ({ products, ...o }) => ({ ...o, productName: products?.name ?? "—" }),
    ),
    months,
    // Single-currency academy for now; multi-currency reporting would group by currency.
    currency: orders[0]?.currency ?? "GBP",
    // Tolerates the enquiries table not existing yet (migration not run).
    newEnquiries: ((enquiriesRes.data ?? []) as { id: string; name: string; created_at: string; answers: { name: string; value: string }[] }[]).map((e) => ({
      id: e.id,
      name: e.name,
      created_at: e.created_at,
      experience: e.answers.find((a) => a.name === "experience")?.value ?? null,
    })),
    newEnquiryCount: enquiriesRes.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export interface EnrolmentActivity {
  student: string;
  course: string;
  source: string;
  status: string;
  grantedAt: string;
}

export interface AdminOverview {
  canSeeStudents: boolean;
  canSeePayments: boolean;
  activeStudents: number;
  pendingPayments: number;
  avgCompletion: number | null;
  enrolmentsByMonth: number[];
  enrolmentsChange: string | null;
  recentEnrolments: EnrolmentActivity[];
  months: MonthBucket[];
}

export async function loadAdminOverview(
  supabase: SupabaseClient,
  roles: Role[],
  permissions: StaffPermission[],
): Promise<AdminOverview> {
  const months = lastTwelveMonths();
  const canSeeStudents =
    hasPermission(roles, permissions, "students.read") || hasPermission(roles, permissions, "enrolments.manage");
  const canSeePayments = hasPermission(roles, permissions, "payments.read");
  const empty = months.map(() => 0);
  if (!canSeeStudents && !canSeePayments) {
    return { canSeeStudents, canSeePayments, activeStudents: 0, pendingPayments: 0, avgCompletion: null, enrolmentsByMonth: empty, enrolmentsChange: null, recentEnrolments: [], months };
  }

  const [enrolRes, recentRes, progRes, pendingRes] = await Promise.all([
    canSeeStudents
      ? supabase.from("enrolments").select("user_id, granted_at").eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    canSeeStudents
      ? supabase
          .from("enrolments")
          .select("user_id, status, source, granted_at, courses(title)")
          .order("granted_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
    canSeeStudents ? supabase.from("course_progress").select("*") : Promise.resolve({ data: [], error: null }),
    canSeePayments
      ? supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: 0, error: null }),
  ]);
  throwIf(enrolRes.error, "enrolments");
  throwIf(recentRes.error, "recent enrolments");
  throwIf(progRes.error, "course_progress");
  throwIf(pendingRes.error, "pending orders");

  const enrolments = (enrolRes.data ?? []) as { user_id: string; granted_at: string }[];
  const recent = (recentRes.data ?? []) as unknown as {
    user_id: string;
    status: string;
    source: string;
    granted_at: string;
    courses: { title: string } | null;
  }[];
  const names = await profileNames(supabase, [...new Set(recent.map((r) => r.user_id))]);
  const enrolmentsByMonth = bucketise(enrolments, months, (e) => e.granted_at, () => 1);

  return {
    canSeeStudents,
    canSeePayments,
    activeStudents: new Set(enrolments.map((e) => e.user_id)).size,
    pendingPayments: ("count" in pendingRes ? pendingRes.count : 0) ?? 0,
    avgCompletion: averageCompletion((progRes.data ?? []) as ProgressRow[]),
    enrolmentsByMonth,
    enrolmentsChange: pctChange(enrolmentsByMonth[11]!, enrolmentsByMonth[10]!),
    recentEnrolments: recent.map((r) => ({
      student: names.get(r.user_id) ?? "—",
      course: r.courses?.title ?? "—",
      source: r.source,
      status: r.status,
      grantedAt: r.granted_at,
    })),
    months,
  };
}
