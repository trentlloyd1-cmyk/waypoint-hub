import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LAST_ACTIVE_COOKIE } from "@/lib/routes";

/** POST only, so a stray link or image can't sign someone out. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const reason = request.nextUrl.searchParams.get("reason") === "timeout" ? "?reason=timeout" : "?reason=signed-out";
  const response = NextResponse.redirect(new URL(`/login${reason}`, request.nextUrl.origin), { status: 303 });
  response.cookies.delete(LAST_ACTIVE_COOKIE);
  return response;
}
