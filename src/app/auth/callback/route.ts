import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/routes";

/** Google sign-in (and any code-based login) comes back here. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await supabase.rpc("write_audit", { p_action: "login", p_entity_type: "auth", p_details: { method: "google" } });
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // The invite-only hook rejects people without an invitation; Supabase passes that back as an error.
  const reason = searchParams.get("error_description")?.toLowerCase().includes("invite") ? "not-invited" : "link";
  return NextResponse.redirect(new URL(`/login?reason=${reason}`, origin));
}
