"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { HOME_PATH } from "@/lib/routes";

type Enrolment = { factorId: string; qr: string; secret: string };

/**
 * Two-step sign-in with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).
 * "enrol": first-time setup with a QR code. "verify": enter today's code.
 */
export function MfaForm({ mode }: { mode: "enrol" | "verify" }) {
  const router = useRouter();
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      if (mode === "verify") {
        const { data } = await supabase.auth.mfa.listFactors();
        setFactorId(data?.totp?.[0]?.id ?? null);
        return;
      }
      // Clear any half-finished setup from an earlier attempt, then start fresh.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
      if (error || !data) return setError("We couldn't start two-step setup. Refresh the page to try again.");
      setEnrolment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setFactorId(data.id);
    })();
  }, [mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from your authenticator app.");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) {
      setBusy(false);
      setCode("");
      return setError("That code didn't match. Codes change every 30 seconds, so try the newest one.");
    }
    router.replace(HOME_PATH);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          {mode === "enrol" ? "Set up two-step sign-in" : "One more step"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {mode === "enrol"
            ? "A second check that it's really you, using your phone. Admins must have it because they can see everyone's information. Setup takes about a minute."
            : "Open your authenticator app and type the 6-digit code for Waypoint Hub."}
        </p>
      </div>

      {mode === "enrol" && (
        <ol className="list-decimal space-y-4 pl-5 text-sm">
          <li>
            Install an authenticator app on your phone if you don&apos;t have one (Google Authenticator or Microsoft
            Authenticator are free).
          </li>
          <li>
            In the app, tap <strong>Add</strong> and scan this code:
            <div className="mt-3 flex justify-center rounded-lg bg-white p-3">
              {enrolment ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={enrolment.qr} alt="QR code to scan with your authenticator app" width={180} height={180} />
              ) : (
                <div className="flex size-[180px] items-center justify-center" aria-live="polite">
                  <Loader2 className="animate-spin text-teal-700" aria-label="Loading QR code" />
                </div>
              )}
            </div>
            {enrolment && (
              <p className="mt-2 text-muted-foreground">
                Can&apos;t scan it? Choose &ldquo;enter a setup key&rdquo; and type:{" "}
                <code className="break-all rounded bg-muted px-1 py-0.5 font-mono text-foreground">{enrolment.secret}</code>
              </p>
            )}
          </li>
          <li>Type the 6-digit code the app shows:</li>
        </ol>
      )}

      <div className="space-y-2">
        <Label htmlFor="totp">6-digit code</Label>
        <Input
          id="totp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "mfa-error" : undefined}
          className="h-12 text-center text-2xl tracking-[0.5em] tabular"
          autoFocus={mode === "verify"}
        />
      </div>
      {error && (
        <p id="mfa-error" role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={busy || !factorId}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        {mode === "enrol" ? "Turn on two-step sign-in" : "Continue"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Lost your phone? Another Admin can reset two-step sign-in for you.
      </p>
    </form>
  );
}
