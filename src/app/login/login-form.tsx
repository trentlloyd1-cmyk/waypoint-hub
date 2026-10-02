"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const emailSchema = z.email("That doesn't look like an email address. Check for typos?");
const codeSchema = z.string().regex(/^\d{6}$/, "The code is 6 numbers, from the email we just sent.");

export function LoginForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) return setError(parsed.error.issues[0].message);

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        // New accounts are only created for invited people: the database's invite-only hook enforces it.
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);

    // Same message whether or not the address exists, so the form can't be used to check who works here.
    if (error && error.status !== 400 && error.status !== 422) {
      return setError("Something went wrong sending your email. Please try again in a minute.");
    }
    setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = codeSchema.safeParse(code.trim());
    if (!parsed.success) return setError(parsed.error.issues[0].message);

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: parsed.data, type: "email" });
    if (error) {
      setBusy(false);
      return setError("That code didn't work. It may have expired, so you can ask for a new one.");
    }
    await supabase.rpc("write_audit", { p_action: "login", p_entity_type: "auth", p_details: { method: "email_code" } });
    router.replace(next);
    router.refresh();
  }

  async function signInWithGoogle() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setBusy(false);
      setError("Google sign-in isn't available right now. Try the email option instead.");
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="mt-6 space-y-4" noValidate>
        <div className="rounded-lg bg-muted p-4 text-sm">
          <p className="font-semibold">Check your inbox</p>
          <p className="mt-1 text-muted-foreground">
            If <strong className="text-foreground">{email}</strong> has a Waypoint Hub account, we&apos;ve just emailed a
            sign-in link. Tap the link, or type the 6-digit code from the email here.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            className="h-12 text-center text-2xl tracking-[0.5em] tabular"
            autoFocus
          />
        </div>
        {error && (
          <p id="login-error" role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Sign in
        </Button>
        <Button
          type="button"
          variant="link"
          className="w-full"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
        >
          Use a different email or send a new link
        </Button>
      </form>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <form onSubmit={sendLink} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@waypointconnect.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : "email-hint"}
            className="h-11 text-base"
            autoFocus
          />
          <p id="email-hint" className="text-sm text-muted-foreground">
            We&apos;ll email you a sign-in link. No password to remember.
          </p>
        </div>
        {error && (
          <p id="login-error" role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Mail aria-hidden />}
          Email me a sign-in link
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden>
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" size="lg" className="h-11 w-full text-base" onClick={signInWithGoogle} disabled={busy}>
            <GoogleIcon />
            Continue with Google
          </Button>
        </>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
