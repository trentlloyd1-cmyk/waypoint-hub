import { TZDate } from "@date-fns/tz";
import { format, formatDistanceToNowStrict } from "date-fns";
import { enAU } from "date-fns/locale";

/** Everything is shown in Brisbane time, whatever the device's clock says. */
export const TIMEZONE = "Australia/Brisbane";

function inBrisbane(value: string | Date) {
  return new TZDate(typeof value === "string" ? new Date(value) : value, TIMEZONE);
}

/** 02/10/2026 */
export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  return format(inBrisbane(value), "dd/MM/yyyy", { locale: enAU });
}

/** 02/10/2026, 3:45 pm */
export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "";
  return format(inBrisbane(value), "dd/MM/yyyy, h:mm aaa", { locale: enAU });
}

/** 3:45 pm */
export function formatTime(value: string | Date | null | undefined) {
  if (!value) return "";
  return format(inBrisbane(value), "h:mm aaa", { locale: enAU });
}

/** "Today, 3:45 pm", "Yesterday, 9:10 am" or "02/10/2026" */
export function formatFriendly(value: string | Date | null | undefined) {
  if (!value) return "";
  // Compare calendar days in Brisbane, not on the device's clock.
  const day = formatDate(value);
  if (day === formatDate(new Date())) return `Today, ${formatTime(value)}`;
  if (day === formatDate(new Date(Date.now() - 86_400_000))) return `Yesterday, ${formatTime(value)}`;
  return day;
}

/** "5 minutes ago" */
export function formatAgo(value: string | Date | null | undefined) {
  if (!value) return "";
  return `${formatDistanceToNowStrict(new Date(value), { locale: enAU })} ago`;
}

/** Morning / afternoon / evening greeting in Brisbane time. */
export function greeting(now = new Date()) {
  const h = inBrisbane(now).getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Long date for headings: "Friday 2 October" */
export function formatLongDate(value: string | Date = new Date()) {
  return format(inBrisbane(value), "EEEE d MMMM", { locale: enAU });
}

export function fullName(p: { first_name: string; last_name: string; preferred_name?: string | null }) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ");
}

/** Shows the name someone likes to be called, with their legal name for context. */
export function displayName(p: { first_name: string; last_name: string; preferred_name?: string | null }) {
  const name = fullName(p);
  return p.preferred_name && p.preferred_name !== p.first_name ? `${name} (${p.preferred_name})` : name;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** Formats an Australian phone number for display: 0412 345 678 / (07) 3180 0649. */
export function formatPhone(value: string | null | undefined) {
  if (!value) return "";
  const d = value.replace(/\D/g, "").replace(/^61/, "0");
  if (/^04\d{8}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (/^0[2378]\d{8}$/.test(d)) return `(${d.slice(0, 2)}) ${d.slice(2, 6)} ${d.slice(6)}`;
  if (/^1[38]00\d{6}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return value;
}

export const ORGANISATION_TYPE_LABELS = {
  support_coordination: "Support coordination",
  plan_management: "Plan management",
  lac: "Local Area Coordinator (LAC)",
  carer_org: "Carer organisation",
  allied_health: "Allied health",
  community_group: "Community group",
  government: "Government",
  other: "Other",
} as const;
