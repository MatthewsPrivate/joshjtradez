/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  /** Comma-separated verified emails that are made owner + teacher on sign-in. */
  readonly ACADEMY_OWNER_EMAILS?: string;
  /** Comma-separated verified emails that get the hidden developer role on sign-in. */
  readonly ACADEMY_DEVELOPER_EMAILS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    supabase: import("@supabase/supabase-js").SupabaseClient;
    user: import("@supabase/supabase-js").User | null;
    roles: import("./lib/academy/roles").Role[];
    permissions: import("./lib/academy/roles").StaffPermission[];
    profile: { full_name: string; display_name: string | null; status: "active" | "suspended" } | null;
  }
}
