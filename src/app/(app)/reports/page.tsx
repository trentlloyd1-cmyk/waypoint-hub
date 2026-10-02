import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Reports" };

export default async function Page() {
  await requireRole("admin", "manager", "bizdev");
  return (
    <ComingSoon
      title="Reports"
      phase={2}
      summary="How we're tracking."
      features={[
      "Lead funnel and conversion by stage, source and partner",
      "Average time from enquiry to onboarding",
      "Referral volume by partner over time",
      "A one-click weekly summary to send every Friday (Phase 5)",
      ]}
    />
  );
}
