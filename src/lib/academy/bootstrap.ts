import type { User } from "@supabase/supabase-js";
import { audit } from "./audit";
import type { Role } from "./roles";
import { createServiceClient } from "./supabase";

// Accounts whose (verified) email is listed in one of these env vars get the
// matching roles on their first signed-in request, so nobody needs to run SQL:
//   ACADEMY_OWNER_EMAILS     -> owner + teacher (Josh)
//   ACADEMY_DEVELOPER_EMAILS -> developer (hidden; the site's developer)
// Relies on Supabase "Confirm email" staying ON — otherwise anyone could sign
// up with one of these addresses before its real owner does.
const GRANTS: { env: string | undefined; roles: Role[]; label: string }[] = [
  { env: import.meta.env.ACADEMY_OWNER_EMAILS, roles: ["owner", "teacher"], label: "ACADEMY_OWNER_EMAILS" },
  { env: import.meta.env.ACADEMY_DEVELOPER_EMAILS, roles: ["developer"], label: "ACADEMY_DEVELOPER_EMAILS" },
];

const emails = (env: string | undefined) =>
  (env ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** Roles this user is entitled to by email but doesn't hold yet. */
export function pendingBootstrapRoles(user: User, roles: Role[]): { roles: Role[]; via: string[] } {
  if (!user.email || !user.email_confirmed_at) return { roles: [], via: [] };
  const email = user.email.toLowerCase();
  const missing = new Set<Role>();
  const via: string[] = [];
  for (const g of GRANTS) {
    if (!emails(g.env).includes(email)) continue;
    const add = g.roles.filter((r) => !roles.includes(r));
    if (add.length) via.push(g.label);
    add.forEach((r) => missing.add(r));
  }
  return { roles: [...missing], via };
}

/** Grants the pending roles. Returns the roles actually added. */
export async function bootstrapRoles(user: User, pending: { roles: Role[]; via: string[] }): Promise<Role[]> {
  const { error } = await createServiceClient()
    .from("user_roles")
    .upsert(pending.roles.map((role) => ({ user_id: user.id, role })), { onConflict: "user_id,role", ignoreDuplicates: true });
  if (error) {
    console.error("[bootstrap] could not grant roles:", error.message);
    return [];
  }
  await audit({
    actorId: user.id,
    action: "roles.bootstrapped",
    targetType: "user",
    targetId: user.id,
    metadata: { roles: pending.roles, via: pending.via },
  });
  return pending.roles;
}
