import type { z } from "zod";

/** What every Server Action returns: a friendly message either way, plus field errors for forms. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function zodFail(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    fieldErrors[key] ??= issue.message;
  }
  return fail("A few things need fixing. Check the highlighted fields.", fieldErrors);
}

/**
 * Turns database errors into plain English, without leaking details (names, emails)
 * into the browser or logs.
 */
export function friendlyDbError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "42501":
      return error.message && !error.message.includes("row-level security")
        ? error.message
        : "You don't have access to do that. Ask an Admin if you need it.";
    case "23505":
      return "That already exists.";
    case "23503":
      return "That's linked to something that no longer exists. Refresh and try again.";
    case "23514":
      return error.message ?? "That value isn't allowed.";
    case "PGRST116":
      return "We couldn't find that record. It may have been deleted.";
    default:
      return "Something went wrong saving that. Please try again.";
  }
}
