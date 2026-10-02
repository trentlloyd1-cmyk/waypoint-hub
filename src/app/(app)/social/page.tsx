import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Social" };

export default async function Page() {
  await requireRole("admin", "manager", "bizdev");
  return (
    <ComingSoon
      title="Social"
      phase={4}
      summary="Facebook and LinkedIn, planned and measured."
      features={[
      "Write once, tailor for each platform, schedule ahead",
      "An approval step for posts by non-Admins",
      "Followers, reach and engagement, with CSV/PDF export",
      "Works in 'manual mode' until Meta and LinkedIn approve API access",
      ]}
    />
  );
}
