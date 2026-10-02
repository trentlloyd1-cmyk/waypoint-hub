import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";
import { HOME_PATH, LAST_ACTIVE_COOKIE, isPublicPath } from "@/lib/routes";

/** Signed-in sessions end after this long without any activity. */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Runs before every page request:
 *  - keeps the Supabase login session fresh,
 *  - sends signed-out visitors to the login page,
 *  - signs people out after 30 minutes idle.
 * Real permission checks happen in the database (RLS) and in each page; this is the first gate.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Verifies the session token. Don't put code between createServerClient and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
    const redirect = NextResponse.redirect(url);
    // Carry over any refreshed or cleared auth cookies.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (signedIn) {
    const lastActive = Number(request.cookies.get(LAST_ACTIVE_COOKIE)?.value ?? 0);
    if (lastActive && Date.now() - lastActive > IDLE_TIMEOUT_MS && !pathname.startsWith("/auth")) {
      await supabase.auth.signOut({ scope: "local" });
      const r = redirectTo("/login", { reason: "timeout" });
      r.cookies.delete(LAST_ACTIVE_COOKIE);
      return r;
    }
    response.cookies.set(LAST_ACTIVE_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
    });
    if (pathname === "/login") return redirectTo(HOME_PATH);
  } else if (!isPublicPath(pathname)) {
    // Remember where they were going (path only, never query strings with data in them).
    return redirectTo("/login", pathname !== "/" && pathname !== HOME_PATH ? { next: pathname } : undefined);
  }

  // Basic hardening headers for every page.
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: [
    // Everything except static files, images and the PWA manifest.
    "/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|manifest.webmanifest|robots.txt|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
