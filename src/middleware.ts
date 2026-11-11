import { defineMiddleware } from "astro:middleware";
import { createUserClient } from "./lib/academy/supabase";
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

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname.replace(/\/+$/, "") || "/";

  // The marketing site is prerendered and never touches auth.
  if (ctx.isPrerendered || !isAcademyPath(path)) return next();

  const supabase = createUserClient(ctx);
  ctx.locals.supabase = supabase;
  ctx.locals.roles = [];
  ctx.locals.permissions = [];
  ctx.locals.profile = null;

  // getUser() validates the JWT with Supabase Auth; getSession() alone would trust the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  ctx.locals.user = user;

  if (user) {
    const [roles, perms, profile] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("staff_permissions").select("permission").eq("user_id", user.id),
      supabase.from("profiles").select("full_name, display_name, status").eq("id", user.id).single(),
    ]);
    ctx.locals.roles = (roles.data ?? []).map((r) => r.role as Role);
    ctx.locals.permissions = (perms.data ?? []).map((p) => p.permission as StaffPermission);
    ctx.locals.profile = profile.data;
  }

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

  const response = await next();
  // Authenticated pages are per-user: never cache them at the edge.
  response.headers.set("cache-control", "private, no-store");
  return response;
});
