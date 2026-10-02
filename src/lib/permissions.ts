import type { AppRole } from "@/lib/database.types";

/**
 * What each role can do, in one place. The database (RLS) is the real enforcement;
 * this just decides what to show so people aren't offered buttons that won't work.
 */
export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  bizdev: "Business Development",
  support: "Support Staff",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Everything, including settings, integrations, users and the audit log.",
  manager: "Everything except integrations and user management.",
  bizdev: "Leads, referrals, partners, contacts, calendar, messages, social and events.",
  support: "Their own calendar, messages, the news feed, and leads assigned to them.",
};

const GROWTH: AppRole[] = ["admin", "manager", "bizdev"];
const MANAGEMENT: AppRole[] = ["admin", "manager"];

export const can = {
  viewContacts: (r: AppRole) => GROWTH.includes(r),
  editContacts: (r: AppRole) => GROWTH.includes(r),
  deleteContacts: (r: AppRole) => MANAGEMENT.includes(r),
  mergeContacts: (r: AppRole) => MANAGEMENT.includes(r),
  importContacts: (r: AppRole) => GROWTH.includes(r),
  exportData: (r: AppRole) => MANAGEMENT.includes(r),
  manageTags: (r: AppRole) => MANAGEMENT.includes(r),
  manageCustomFields: (r: AppRole) => MANAGEMENT.includes(r),
  manageUsers: (r: AppRole) => r === "admin",
  manageIntegrations: (r: AppRole) => r === "admin",
  viewAuditLog: (r: AppRole) => r === "admin",
  viewLeads: () => true,
  viewPartners: (r: AppRole) => GROWTH.includes(r),
  viewSocial: (r: AppRole) => GROWTH.includes(r),
  viewReports: (r: AppRole) => MANAGEMENT.includes(r) || r === "bizdev",
};
