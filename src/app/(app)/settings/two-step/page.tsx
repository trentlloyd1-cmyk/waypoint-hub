import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaForm } from "@/app/mfa/mfa-form";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Set up two-step sign-in" };

export default async function TwoStepPage() {
  const user = await requireUser();
  if (user.hasVerifiedFactor) redirect("/settings");
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 sm:p-8">
      <MfaForm mode="enrol" />
    </div>
  );
}
