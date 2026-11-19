// Who must use two-factor authentication.
// Staff accounts (owner/admin/teacher/developer) can see student data and money,
// so they're prompted to turn it on; set ACADEMY_REQUIRE_STAFF_MFA=true to make
// it mandatory (staff without 2FA are sent to the setup page until they enable it).
import type { Role } from "./roles";

const STAFF: readonly Role[] = ["owner", "admin", "teacher", "developer"];

export const isStaff = (roles: readonly Role[]) => roles.some((r) => STAFF.includes(r));

export const mfaRequiredFor = (roles: readonly Role[]) => isStaff(roles) && import.meta.env.ACADEMY_REQUIRE_STAFF_MFA === "true";

/** Paths an aal1 session may use while it still owes a 2FA step. */
export const MFA_PATHS = new Set(["/academy/mfa", "/academy/mfa/setup", "/api/academy/mfa", "/api/academy/auth/logout"]);
