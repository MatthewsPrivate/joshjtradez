import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

/** False until the Supabase env vars are set (e.g. a deploy before setup). */
export const isSupabaseConfigured = () =>
  Boolean(import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_ANON_KEY);

const url = () => requireEnv("PUBLIC_SUPABASE_URL", import.meta.env.PUBLIC_SUPABASE_URL);
const anonKey = () =>
  requireEnv("PUBLIC_SUPABASE_ANON_KEY", import.meta.env.PUBLIC_SUPABASE_ANON_KEY);

/**
 * Per-request client acting as the signed-in user. All queries go through RLS.
 * Session cookies are read from the request and refreshed tokens written back.
 */
export function createUserClient(ctx: { request: Request; cookies: AstroCookies }): SupabaseClient {
  return createServerClient(url(), anonKey(), {
    cookies: {
      getAll() {
        return parseCookieHeader(ctx.request.headers.get("cookie") ?? "").map(
          ({ name, value }) => ({ name, value: value ?? "" }),
        );
      },
      setAll(cookies) {
        for (const { name, value, options } of cookies) {
          ctx.cookies.set(name, value, { ...options, path: options.path ?? "/" });
        }
      },
    },
  });
}

let serviceClient: SupabaseClient | undefined;

/**
 * Service-role client. BYPASSES RLS — server-only, for audited privileged writes
 * (role grants, enrolments from verified payments, audit log). Never import from
 * client-side code.
 */
export function createServiceClient(): SupabaseClient {
  if (import.meta.env.SSR !== true) throw new Error("Service client is server-only.");
  serviceClient ??= createClient(
    url(),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", import.meta.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return serviceClient;
}
