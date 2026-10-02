import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Community" };

export default function Page() {
  return (
    <ComingSoon
      title="Community"
      phase={3}
      summary="Team news and community events."
      features={[
      "A news feed for wins, updates and policy reminders, with 'must read' tracking",
      "Automatic posts when a referral arrives or a lead is onboarded",
      "Community events with public registration, waitlists and phone check-in (Phase 4)",
      ]}
    />
  );
}
