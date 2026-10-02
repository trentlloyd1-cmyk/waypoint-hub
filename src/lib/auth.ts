import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { AppRole, Profile } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  profile: Profile;
  /** Current assurance level: aal2 means they've passed two-factor this session. */
  aal: "aal1" | "aal2";
  hasVerifiedFactor: boolean;
};

/**
 * The signed-in staff member, or null. Cached per request.
 * Verifies the session with Supabase rather than trusting the cookie.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile || !profile.active) return null;

  // The verified token says whether two-step was passed this session.
  const aal = claims.aal === "aal2" ? "aal2" : "aal1";
  // If not, ask the auth server whether they have an authenticator set up.
  // (getUser checks with the server, unlike reading the session cookie directly.)
  let hasVerifiedFactor = aal === "aal2";
  if (!hasVerifiedFactor) {
    const { data } = await supabase.auth.getUser();
    hasVerifiedFactor = Boolean(data.user?.factors?.some((f) => f.factor_type === "totp" && f.status === "verified"));
  }

  return { id: userId, email: profile.email, profile, aal, hasVerifiedFactor };
});

/** For pages and actions that need a signed-in person who has passed any required two-factor check. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (needsMfaStep(user)) redirect("/mfa");
  return user;
}

/** Same as requireUser, plus a role check. Shows the friendly "no access" page otherwise. */
export async function requireRole(...roles: AppRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.profile.role)) redirect("/no-access");
  return user;
}

/**
 * Whether this person still has a two-factor step to do:
 *  - anyone with an authenticator app set up must enter a code each session;
 *  - anyone whose account requires 2FA (Admins by default) must set one up.
 */
export function needsMfaStep(user: CurrentUser) {
  if (user.hasVerifiedFactor) return user.aal !== "aal2";
  return user.profile.mfa_required;
}

/** For Server Actions: returns the user or throws a friendly error (no redirects mid-action). */
export async function actionUser(...roles: AppRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || needsMfaStep(user)) throw new Error("Your session has ended. Please sign in again.");
  if (roles.length && !roles.includes(user.profile.role)) {
    throw new Error("You don't have access to do that. Ask an Admin if you need it.");
  }
  return user;
}
