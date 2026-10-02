import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { serverEnv } from "@/lib/server-env";
import { safeNextPath } from "@/lib/routes";
import { LoginForm } from "./login-form";
import { DevLogin } from "./dev-login";

export const metadata: Metadata = { title: "Sign in" };

const REASONS: Record<string, { tone: "info" | "warn"; text: string }> = {
  timeout: { tone: "info", text: "You were signed out after 30 minutes without activity, to keep everyone's information safe. Sign in again to pick up where you left off." },
  "signed-out": { tone: "info", text: "You're signed out. See you next time!" },
  link: { tone: "warn", text: "That sign-in link has expired or was already used. No worries, just ask for a new one below." },
  "not-invited": { tone: "warn", text: "We couldn't find an invitation for that account. Waypoint Hub is invite-only, so ask an Admin to invite you." },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? REASONS[params.reason] : undefined;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "true";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-teal-50 to-background px-4 py-10 dark:from-teal-950/40">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo height={64} />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-muted-foreground">Sign in to see today&apos;s referrals, leads and team news.</p>

          {reason && (
            <p
              role="status"
              className={
                reason.tone === "warn"
                  ? "mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
                  : "mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-100"
              }
            >
              {reason.text}
            </p>
          )}

          <LoginForm next={next} googleEnabled={googleEnabled} />
        </div>

        {serverEnv().ENABLE_DEV_LOGIN && <DevLogin next={next} />}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Waypoint Connect Pty Ltd · Clontarf QLD
        </p>
      </div>
    </main>
  );
}
