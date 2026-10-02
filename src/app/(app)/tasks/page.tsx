import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Tasks" };

export default function Page() {
  return (
    <ComingSoon
      title="Tasks"
      phase={2}
      summary="Your to-do list, linked to the people and records it's about."
      features={[
      "Personal and assigned tasks with due dates and priorities",
      "Recurring tasks",
      "Tasks show up on your Today screen",
      ]}
    />
  );
}
