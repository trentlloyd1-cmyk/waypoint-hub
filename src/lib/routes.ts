/** Pages anyone can open without signing in (public forms, login, legal pages). */
export const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/auth",
  "/refer",
  "/events",
  "/book",
  "/data-deletion",
  "/unsubscribe",
] as const;

export function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Where a signed-in person lands. */
export const HOME_PATH = "/today";

/** Only ever send people to a page on this site after login (stops "open redirect" tricks). */
export function safeNextPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return HOME_PATH;
  return next;
}

/** Cookie holding the time of the last request, for the idle timeout. Not sensitive. */
export const LAST_ACTIVE_COOKIE = "wh_last_active";
