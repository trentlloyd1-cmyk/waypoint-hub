import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return (
    <ComingSoon
      title="Calendar"
      phase={3}
      summary="Intake calls, meet and greets, partner meetings and events."
      features={[
      "Month, week, day and agenda views, plus a team view",
      "Two-way sync with each person's Google Calendar",
      "Shareable booking links for intake calls and partner meetings",
      "Email, in-app and optional SMS reminders",
      ]}
    />
  );
}
