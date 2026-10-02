import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Leads" };

export default function Page() {
  return (
    <ComingSoon
      title="Leads"
      phase={2}
      summary="Every enquiry, from first call to onboarded."
      features={[
      "A drag-and-drop board with your 7 stages, plus a list view",
      "Clear flags for NDIA-managed leads and under-18s (guardian details and consent required)",
      "Follow-up reminders and 'gone quiet' alerts",
      "Duplicate detection on name, phone and email",
      "'Convert to participant' sends the record to ShiftCare (Phase 5)",
      ]}
    />
  );
}
