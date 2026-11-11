/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  /** Comma-separated verified emails that are made owner + teacher on sign-in. */
  readonly ACADEMY_OWNER_EMAILS?: string;
  /** Comma-separated verified emails that get the hidden developer role on sign-in. */
  readonly ACADEMY_DEVELOPER_EMAILS?: string;
  /** Resend API key — enables emailing contact-form enquiries. */
  readonly RESEND_API_KEY?: string;
  /** Where enquiry emails go (defaults to ACADEMY_OWNER_EMAILS). */
  readonly CONTACT_NOTIFY_EMAIL?: string;
  /** Sender, e.g. "JoshJTradez <hello@yourdomain.com>" once a domain is verified in Resend. */
  readonly CONTACT_FROM_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    supabase: import("@supabase/supabase-js").SupabaseClient;
    /** Verified from the session JWT's claims (see middleware). */
    user: { id: string; email: string | null } | null;
    roles: import("./lib/academy/roles").Role[];
    permissions: import("./lib/academy/roles").StaffPermission[];
    profile: { full_name: string; display_name: string | null; status: "active" | "suspended" } | null;
  }
}
