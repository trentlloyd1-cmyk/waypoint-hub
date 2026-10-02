import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Messages" };

export default function Page() {
  return (
    <ComingSoon
      title="Messages"
      phase={3}
      summary="Team chat, email and SMS in one place."
      features={[
      "Team channels and direct messages with @mentions and attachments",
      "Send email from your Waypoint address with templates, logged on the timeline",
      "Two-way SMS through MessageMedia",
      "One inbox for email and SMS replies, matched to the right contact",
      ]}
    />
  );
}
