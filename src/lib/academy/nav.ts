// Sidebar navigation per portal, from the Figma Make design.
// `slug` is the URL segment under /academy/<portal>/ ("" = overview).
import type { IconName } from "../../components/academy/Icon";
import { PORTALS, type Role } from "./roles";

export interface NavItem {
  label: string;
  icon: IconName;
  slug: string;
}

const item = (label: string, icon: IconName): NavItem => ({
  label,
  icon,
  slug: label === "Overview" ? "" : label.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
});

export const NAV: Record<Role, NavItem[]> = {
  student: [
    item("Overview", "grid"),
    item("My academy", "book"),
    item("Learning journal", "note"),
    item("Trading journal", "chart"),
    item("Assessments", "check"),
    item("Live classes", "calendar"),
    item("Community", "users"),
    item("Messages", "message"),
    item("Toolkit", "tool"),
    item("Certificates", "award"),
    item("Billing & access", "wallet"),
    item("Settings", "settings"),
  ],
  teacher: [
    item("Overview", "grid"),
    item("My courses", "book"),
    item("My classes", "calendar"),
    item("Students", "users"),
    item("Course builder", "tool"),
    item("Assignments", "note"),
    item("Grading centre", "check"),
    item("Live classes", "play"),
    item("Messages", "message"),
    item("Teaching analytics", "chart"),
    item("Settings", "settings"),
  ],
  admin: [
    item("Overview", "grid"),
    item("Students", "users"),
    item("Teachers", "briefcase"),
    item("Courses", "book"),
    item("Enrolments", "check"),
    item("Payments", "wallet"),
    item("Assessments", "note"),
    item("Live classes", "calendar"),
    item("Community", "message"),
    item("Support tickets", "tool"),
    item("Permissions", "shield"),
    item("Settings", "settings"),
  ],
  owner: [
    item("Overview", "grid"),
    item("Finance", "wallet"),
    item("Revenue analytics", "chart"),
    item("Student analytics", "users"),
    item("Products", "book"),
    item("Staff", "briefcase"),
    item("Access management", "shield"),
    item("Reports", "note"),
    item("Audit logs", "clock"),
    item("Security centre", "shield"),
    item("Integrations", "tool"),
    item("Settings", "settings"),
  ],
};

/** `base` overrides the portal root (the dev preview serves portals from /dev-preview/<portal>). */
export function navHref(portal: Role, slug: string, base: string = PORTALS[portal].path): string {
  return slug ? `${base}/${slug}` : base;
}

export const portalBase = (portal: Role, previewRoot?: string) =>
  previewRoot ? `${previewRoot}/${portal}` : PORTALS[portal].path;

export function findNavItem(portal: Role, slug: string): NavItem | undefined {
  return NAV[portal].find((n) => n.slug === slug);
}
