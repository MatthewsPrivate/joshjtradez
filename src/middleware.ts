import { defineMiddleware } from "astro:middleware";
import { bootstrapRoles, pendingBootstrapRoles } from "./lib/academy/bootstrap";
import { createUserClient, isSupabaseConfigured } from "./lib/academy/supabase";
import { canOpenPortal, isRole, type Role, type StaffPermission } from "./lib/academy/roles";

// Reachable without a session.
const PUBLIC_ACADEMY_PATHS = new Set([
  "/academy/login",
  "/academy/signup",
  "/academy/forgot-password",
  "/academy/auth/callback",
  "/api/academy/auth/login",
  "/api/academy/auth/signup",
  "/api/academy/auth/forgot",
]);

const isAcademyPath = (p: string) =>
  p === "/academy" || p.startsWith("/academy/") || p.startsWith("/api/academy/");

// Per-instance memory of each user's roles/permissions/profile for 30s, saving a
// database round trip on most page loads. Only drives routing and UI — every
// data read/write is still authorised by RLS in the database — so a role change
// or suspension takes effect for navigation within 30 seconds.
const ACCESS_TTL_MS = 30_000;
type CachedProfile = NonNullable<App.Locals["profile"]>;
const accessCache = new Map<string, { roles: Role[]; permissions: StaffPermission[]; profile: CachedProfile; at: number }>();

// Server-to-server callers (payment provider webhooks) authenticate by signature, not origin.
const CSRF_EXEMPT_PREFIXES = ["/api/academy/payments/webhook/"];
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF guard: a state-changing request must come from a page on this same host.
 * Compares the browser's Origin (or Referer) with the Host it requested, which
 * stays correct behind Vercel's proxy (unlike the function's internal URL).
 */
function isSameSiteRequest(request: Request): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!host || !source || source === "null") return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname.replace(/\/+$/, "") || "/";

  // The marketing site is prerendered and never touches auth.
  if (ctx.isPrerendered || !isAcademyPath(path)) return next();

  if (
    UNSAFE_METHODS.has(ctx.request.method) &&
    !CSRF_EXEMPT_PREFIXES.some((p) => path.startsWith(p)) &&
    !isSameSiteRequest(ctx.request)
  ) {
    return new Response("Cross-site form submissions are not allowed.", { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Academy coming soon · JoshJTradez</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#080a09;color:#f4f1e8;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><p style="color:#d8b564;font:600 11px monospace;letter-spacing:.12em">JOSHJTRADEZ ACADEMY</p><h1 style="font-weight:600">The academy is being set up</h1>
<p style="color:#8f9691">Please check back soon.</p><p><a href="/" style="color:#d8b564">Back to the website</a></p></div>`,
      { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "3600" } },
    );
  }

  const started = performance.now();
  const supabase = createUserClient(ctx);
  ctx.locals.supabase = supabase;
  ctx.locals.roles = [];
  ctx.locals.permissions = [];
  ctx.locals.profile = null;

  // getClaims() verifies the session JWT's signature locally (cached JWKS), so
  // authenticating costs no round trip to Supabase Auth on each request.
  // (It falls back to a server check for projects still on symmetric keys.)
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const user = claims?.sub ? { id: claims.sub, email: (claims.email as string | undefined) ?? null } : null;
  ctx.locals.user = user;
  const authMs = performance.now() - started;

  if (user) {
    // Student pages show this week's lesson count in the sidebar: start that
    // query now so it runs alongside the page's own queries.
    if (path.startsWith("/academy/student")) {
      const monday = new Date();
      monday.setUTCHours(0, 0, 0, 0);
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      ctx.locals.lessonsThisWeek = Promise.resolve(
        supabase
          .from("lesson_progress")
          .select("lesson_id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("completed_at", monday.toISOString()),
      ).then((r) => r.count ?? 0);
    }

    const cached = accessCache.get(user.id);
    if (cached && Date.now() - cached.at < ACCESS_TTL_MS) {
      ctx.locals.roles = [...cached.roles];
      ctx.locals.permissions = [...cached.permissions];
      ctx.locals.profile = cached.profile;
    } else {
      const [roles, perms, profile] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("staff_permissions").select("permission").eq("user_id", user.id),
        supabase.from("profiles").select("full_name, display_name, status, weekly_lesson_goal").eq("id", user.id).single(),
      ]);
      ctx.locals.roles = (roles.data ?? []).map((r) => r.role as Role);
      ctx.locals.permissions = (perms.data ?? []).map((p) => p.permission as StaffPermission);
      ctx.locals.profile = profile.data;
      if (!roles.error && !perms.error && profile.data) {
        if (accessCache.size > 2000) accessCache.clear();
        accessCache.set(user.id, { roles: [...ctx.locals.roles], permissions: [...ctx.locals.permissions], profile: profile.data, at: Date.now() });
      }
    }

    // Rare path: email is on an owner/developer list but roles aren't granted yet.
    // Only then confirm with Supabase Auth that the email is verified.
    const pending = pendingBootstrapRoles(user.email, ctx.locals.roles);
    if (pending.roles.length) {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email_confirmed_at) {
        ctx.locals.roles.push(...(await bootstrapRoles(user.id, pending)));
        accessCache.delete(user.id);
      }
    }
  }
  const rolesMs = performance.now() - started - authMs;

  const isApi = path.startsWith("/api/");
  const deny = (status: 401 | 403, redirect: string) =>
    isApi
      ? new Response(JSON.stringify({ error: status === 401 ? "unauthenticated" : "forbidden" }), {
          status,
          headers: { "content-type": "application/json" },
        })
      : ctx.redirect(redirect);

  if (PUBLIC_ACADEMY_PATHS.has(path)) {
    // Signed-in users don't need the login/signup screens.
    if (user && (path === "/academy/login" || path === "/academy/signup")) {
      return ctx.redirect("/academy");
    }
    return next();
  }

  if (!user) {
    const nextParam = encodeURIComponent(ctx.url.pathname + ctx.url.search);
    return deny(401, `/academy/login?next=${nextParam}`);
  }

  if (ctx.locals.profile?.status === "suspended" && path !== "/academy/suspended" && path !== "/api/academy/auth/logout") {
    return deny(403, "/academy/suspended");
  }

  // /academy/<portal>/... requires a role that can open that portal.
  const portal = path.split("/")[2];
  if (isRole(portal) && !canOpenPortal(portal, ctx.locals.roles)) {
    return deny(403, "/academy?denied=1");
  }

  const pageStart = performance.now();
  const response = await next();
  // Per-user pages: never cached by shared caches, always revalidated by the
  // browser. (Not no-store, so the back/forward cache can restore pages instantly.)
  response.headers.set("cache-control", "private, no-cache");
  response.headers.set(
    "server-timing",
    `auth;dur=${authMs.toFixed(1)}, roles;dur=${rolesMs.toFixed(1)}, page;dur=${(performance.now() - pageStart).toFixed(1)}`,
  );
  return response;
});
