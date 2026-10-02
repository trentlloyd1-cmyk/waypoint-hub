/** The proxy refreshes the session and the "last active" time on every request; this just answers. */
export function POST() {
  return new Response(null, { status: 204 });
}
