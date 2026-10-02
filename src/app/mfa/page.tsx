import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser, needsMfaStep } from "@/lib/auth";
import { HOME_PATH } from "@/lib/routes";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Two-step sign-in" };

export default async function MfaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!needsMfaStep(user)) redirect(HOME_PATH);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-teal-50 to-background px-4 py-10 dark:from-teal-950/40">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo height={56} />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <MfaForm mode={user.hasVerifiedFactor ? "verify" : "enrol"} />
        </div>
      </div>
    </main>
  );
}
