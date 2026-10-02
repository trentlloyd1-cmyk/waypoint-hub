import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/routes";

/**
 * Magic links in our emails point here (token_hash style), so they work even when the
 * email is opened on a different device from the one that asked for it.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  const code = searchParams.get("code");
  if ((tokenHash && type) || code) {
    const supabase = await createClient();
    // Our branded emails send token_hash. Supabase's standard emails (used until custom
    // email sending is set up) come back with a one-time code instead.
    const { error } =
      tokenHash && type
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : await supabase.auth.exchangeCodeForSession(code!);
    if (!error) {
      await supabase.rpc("write_audit", { p_action: "login", p_entity_type: "auth", p_details: { method: "email_link" } });
      return NextResponse.redirect(new URL(next, origin));
    }
  }
  return NextResponse.redirect(new URL("/login?reason=link", origin));
}
