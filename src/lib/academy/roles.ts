// Roles, portals and staff permissions. Mirrors the enums in
// supabase/migrations/*_foundation.sql — keep the two in sync.

// "developer" is hidden: only granted via ACADEMY_DEVELOPER_EMAILS and only
// ever shown to the developer themself.
export const ROLES = ["owner", "admin", "teacher", "student", "developer"] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_PERMISSIONS = [
  "students.read",
  "students.manage",
  "teachers.manage",
  "courses.manage",
  "enrolments.manage",
  "payments.read",
  "payments.refund",
  "assessments.manage",
  "live_classes.manage",
  "community.moderate",
  "support.manage",
  "announcements.manage",
  "roles.manage",
  "reports.read",
  "audit.read",
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export const PORTALS: Record<Role, { label: string; path: string }> = {
  owner: { label: "Owner portal", path: "/academy/owner" },
  admin: { label: "Admin portal", path: "/academy/admin" },
  teacher: { label: "Teacher portal", path: "/academy/teacher" },
  student: { label: "Student portal", path: "/academy/student" },
  developer: { label: "Developer portal", path: "/academy/developer" },
};

/**
 * Which roles may open a given portal. The developer can open every portal for
 * testing. (Owners are kept out of the admin portal for now — Josh switches
 * between Owner and Teacher only.)
 */
export const PORTAL_ACCESS: Record<Role, readonly Role[]> = {
  owner: ["owner", "developer"],
  admin: ["admin", "developer"],
  teacher: ["teacher", "developer"],
  student: ["student", "developer"],
  developer: ["developer"],
};

export function canOpenPortal(portal: Role, roles: readonly Role[]): boolean {
  return PORTAL_ACCESS[portal].some((r) => roles.includes(r));
}

/** Portals a user can open, highest privilege first. */
export function availablePortals(roles: readonly Role[]): Role[] {
  return ROLES.filter((portal) => canOpenPortal(portal, roles));
}

/** Where a user lands after signing in: their highest portal. */
const LANDING_ORDER: Role[] = ["developer", "owner", "admin", "teacher", "student"];
export function defaultPortal(roles: readonly Role[]): Role | undefined {
  return LANDING_ORDER.find((p) => canOpenPortal(p, roles));
}

export function hasPermission(
  roles: readonly Role[],
  permissions: readonly StaffPermission[],
  perm: StaffPermission,
): boolean {
  if (roles.includes("owner") || roles.includes("developer")) return true;
  return roles.includes("admin") && permissions.includes(perm);
}

export function isRole(value: string | undefined): value is Role {
  return (ROLES as readonly string[]).includes(value ?? "");
}
