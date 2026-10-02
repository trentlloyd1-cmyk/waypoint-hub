import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Handshake,
  Megaphone,
  MessagesSquare,
  Settings,
  Sun,
  Users,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/database.types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Who sees it. Omit for everyone. */
  roles?: AppRole[];
  /** Shown in the phone's bottom tab bar (max 4). */
  mobile?: boolean;
  /** Short plain-English description, used in the command bar and first-login tour. */
  description: string;
};

const GROWTH: AppRole[] = ["admin", "manager", "bizdev"];

/** The 8 top-level sections. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/today", label: "Today", icon: Sun, mobile: true, description: "Your day at a glance" },
  { href: "/leads", label: "Leads", icon: Workflow, mobile: true, description: "Enquiries from first call to onboarded" },
  { href: "/partners", label: "Partners & Referrals", icon: Handshake, roles: GROWTH, description: "Who refers to us and how it's going" },
  { href: "/contacts", label: "Contacts", icon: UsersRound, roles: GROWTH, mobile: true, description: "Every person and organisation" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, description: "Meetings, intake calls and events" },
  { href: "/messages", label: "Messages", icon: MessagesSquare, mobile: true, description: "Team chat, email and SMS" },
  { href: "/community", label: "Community", icon: Users, description: "News feed and community events" },
  { href: "/social", label: "Social", icon: Megaphone, roles: GROWTH, description: "Facebook and LinkedIn posts and stats" },
];

/** Tucked into the bottom of the sidebar. */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/tasks", label: "Tasks", icon: CheckSquare, description: "Your to-do list" },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: GROWTH, description: "Funnels, partners and the weekly summary" },
  { href: "/settings", label: "Settings", icon: Settings, description: "Your profile, team and preferences" },
];

export function visibleNav(items: NavItem[], role: AppRole) {
  return items.filter((i) => !i.roles || i.roles.includes(role));
}
