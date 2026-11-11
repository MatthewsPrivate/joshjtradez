import { audit } from "./audit";
import type { Role } from "./roles";
import { createServiceClient } from "./supabase";

// Accounts whose (verified) email is listed in one of these env vars get the
// matching roles on their first signed-in request, so nobody needs to run SQL:
//   ACADEMY_OWNER_EMAILS     -> owner + teacher (Josh)
//   ACADEMY_DEVELOPER_EMAILS -> developer (hidden; the site's developer)
// The caller must confirm the email is verified (Supabase Auth) before granting,
// and Supabase "Confirm email" must stay ON — otherwise anyone could sign up
// with one of these addresses before its real owner does.
const GRANTS: { env: string | undefined; roles: Role[]; label: string }[] = [
  { env: import.meta.env.ACADEMY_OWNER_EMAILS, roles: ["owner", "teacher"], label: "ACADEMY_OWNER_EMAILS" },
  { env: import.meta.env.ACADEMY_DEVELOPER_EMAILS, roles: ["developer"], label: "ACADEMY_DEVELOPER_EMAILS" },
];

const emails = (env: string | undefined) =>
  (env ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** Roles this email is entitled to but the account doesn't hold yet. Cheap: no I/O. */
export function pendingBootstrapRoles(email: string | null, roles: Role[]): { roles: Role[]; via: string[] } {
  if (!email) return { roles: [], via: [] };
  const lower = email.toLowerCase();
  const missing = new Set<Role>();
  const via: string[] = [];
  for (const g of GRANTS) {
    if (!emails(g.env).includes(lower)) continue;
    const add = g.roles.filter((r) => !roles.includes(r));
    if (add.length) via.push(g.label);
    add.forEach((r) => missing.add(r));
  }
  return { roles: [...missing], via };
}

/** Grants the pending roles. Returns the roles actually added. */
export async function bootstrapRoles(userId: string, pending: { roles: Role[]; via: string[] }): Promise<Role[]> {
  const { error } = await createServiceClient()
    .from("user_roles")
    .upsert(pending.roles.map((role) => ({ user_id: userId, role })), { onConflict: "user_id,role", ignoreDuplicates: true });
  if (error) {
    console.error("[bootstrap] could not grant roles:", error.message);
    return [];
  }
  await audit({
    actorId: userId,
    action: "roles.bootstrapped",
    targetType: "user",
    targetId: userId,
    metadata: { roles: pending.roles, via: pending.via },
  });
  return pending.roles;
}
