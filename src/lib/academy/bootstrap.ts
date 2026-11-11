import type { User } from "@supabase/supabase-js";
import { audit } from "./audit";
import type { Role } from "./roles";
import { createServiceClient } from "./supabase";

// Accounts whose (verified) email is listed in ACADEMY_OWNER_EMAILS are made
// owner + teacher on their first signed-in request, so the platform owner never
// needs to run SQL. Relies on Supabase "Confirm email" staying ON — otherwise
// anyone could sign up with the owner's address before they do.
const OWNER_ROLES: Role[] = ["owner", "teacher"];

function ownerEmails(): string[] {
  return (import.meta.env.ACADEMY_OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function shouldBootstrapOwner(user: User, roles: Role[]): boolean {
  if (!user.email || !user.email_confirmed_at) return false;
  if (OWNER_ROLES.every((r) => roles.includes(r))) return false;
  return ownerEmails().includes(user.email.toLowerCase());
}

/** Grants the owner roles. Returns the roles actually added. */
export async function bootstrapOwner(user: User, roles: Role[]): Promise<Role[]> {
  const missing = OWNER_ROLES.filter((r) => !roles.includes(r));
  const { error } = await createServiceClient()
    .from("user_roles")
    .upsert(missing.map((role) => ({ user_id: user.id, role })), { onConflict: "user_id,role", ignoreDuplicates: true });
  if (error) {
    console.error("[bootstrap] could not grant owner roles:", error.message);
    return [];
  }
  await audit({
    actorId: user.id,
    action: "roles.owner_bootstrapped",
    targetType: "user",
    targetId: user.id,
    metadata: { roles: missing, via: "ACADEMY_OWNER_EMAILS" },
  });
  return missing;
}
