// Diagnostics for the hidden Developer portal. Server-only; callers must have
// already verified the developer role. Never returns secret values — only
// whether each setting is present.
import { createServiceClient } from "./supabase";

// Node's process, typed locally (the project doesn't ship @types/node).
const proc = (globalThis as { process?: { env: Record<string, string | undefined>; version: string } }).process;
const runtimeEnv = (key: string): string | undefined => proc?.env[key] || undefined;

export interface EnvCheck {
  key: string;
  set: boolean;
  required: boolean;
  note: string;
}

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DevDiagnostics {
  env: EnvCheck[];
  migrations: CheckResult[];
  counts: { table: string; count: number | null }[];
  runtime: { label: string; value: string }[];
  audit: { created_at: string; action: string; actor_id: string | null; target_type: string | null; target_id: string | null }[];
}

export async function loadDiagnostics(): Promise<DevDiagnostics> {
  const env: EnvCheck[] = [
    { key: "PUBLIC_SUPABASE_URL", set: !!import.meta.env.PUBLIC_SUPABASE_URL, required: true, note: "Supabase project URL" },
    { key: "PUBLIC_SUPABASE_ANON_KEY", set: !!import.meta.env.PUBLIC_SUPABASE_ANON_KEY, required: true, note: "Browser-safe key (RLS enforced)" },
    { key: "SUPABASE_SERVICE_ROLE_KEY", set: !!import.meta.env.SUPABASE_SERVICE_ROLE_KEY, required: true, note: "Server-only; bypasses RLS" },
    { key: "ACADEMY_OWNER_EMAILS", set: !!import.meta.env.ACADEMY_OWNER_EMAILS, required: true, note: "Auto-grants Owner + Teacher" },
    { key: "ACADEMY_DEVELOPER_EMAILS", set: !!import.meta.env.ACADEMY_DEVELOPER_EMAILS, required: false, note: "Auto-grants hidden Developer" },
    { key: "RESEND_API_KEY", set: !!import.meta.env.RESEND_API_KEY, required: false, note: "Emails website enquiries to Josh" },
    { key: "CONTACT_NOTIFY_EMAIL", set: !!import.meta.env.CONTACT_NOTIFY_EMAIL, required: false, note: "Enquiry recipient (else owner email)" },
  ];

  const db = createServiceClient();
  const probe = async (name: string, run: () => PromiseLike<{ error: { message: string } | null }>): Promise<CheckResult> => {
    try {
      const { error } = await run();
      return { name, ok: !error, detail: error ? error.message : "Applied" };
    } catch (e) {
      return { name, ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  };

  const [migrations, counts, auditRes] = await Promise.all([
    Promise.all([
      probe("20261111000000_foundation", () => db.from("profiles").select("id", { head: true, count: "exact" })),
      probe("20261111010000_course_progress_view", () => db.from("course_progress").select("user_id", { head: true })),
      probe("20261111020000_platform", () => db.from("notifications").select("id", { head: true })),
      probe("20261111030000_developer_role", () => db.rpc("is_developer")),
      probe("20261111040000_contact_submissions", () => db.from("contact_submissions").select("id", { head: true })),
    ]),
    Promise.all(
      ["profiles", "courses", "lessons", "enrolments", "orders", "community_posts"].map(async (table) => {
        const { count, error } = await db.from(table).select("*", { head: true, count: "exact" });
        return { table, count: error ? null : (count ?? 0) };
      }),
    ),
    db.from("audit_log").select("created_at, action, actor_id, target_type, target_id").order("created_at", { ascending: false }).limit(15),
  ]);

  // Round-trip time from this server to the database: best of 5 sequential tiny
  // queries (the first may include connection setup). Should be single-digit ms
  // when the functions run in the same region as Supabase.
  const rtts: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    await db.rpc("is_developer");
    rtts.push(performance.now() - t);
  }
  const dbLatency = Math.min(...rtts);

  const sha = runtimeEnv("VERCEL_GIT_COMMIT_SHA");
  return {
    env,
    migrations,
    counts,
    runtime: [
      { label: "Mode", value: import.meta.env.DEV ? "development (local)" : "production build" },
      { label: "Vercel environment", value: runtimeEnv("VERCEL_ENV") ?? "not on Vercel" },
      { label: "Function region", value: runtimeEnv("VERCEL_REGION") ?? "local" },
      { label: "Database round trip", value: `${dbLatency.toFixed(1)} ms (best of 5)` },
      { label: "Git branch", value: runtimeEnv("VERCEL_GIT_COMMIT_REF") ?? "—" },
      { label: "Git commit", value: sha ? sha.slice(0, 7) : "—" },
      { label: "Node.js", value: proc?.version ?? "—" },
    ],
    audit: auditRes.data ?? [],
  };
}
