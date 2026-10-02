import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Partners & Referrals" };

export default async function Page() {
  await requireRole("admin", "manager", "bizdev");
  return (
    <ComingSoon
      title="Partners & Referrals"
      phase={2}
      summary="Who refers to us, and how each relationship is going."
      features={[
      "A directory of support coordinators, plan managers, LACs and more",
      "Log every referral against the person and organisation who sent it",
      "A scorecard: referrals sent, conversion rate, last contact, relationship health",
      "A branded public referral form you can share with partners",
      "Optional 'thank you, here's an update' emails to referrers",
      ]}
    />
  );
}
