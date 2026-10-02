/**
 * Invites the first real Admin (you!), since nobody can sign in to invite anyone yet.
 *
 *   npm run add-admin -- you@waypointconnect.org "Your Name"
 *
 * Then go to the sign-in page, enter that email and use the link or code that arrives.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../src/lib/database.types";

config({ path: ".env.local" });

const [emailArg, ...nameParts] = process.argv.slice(2);
const email = z.email().safeParse(emailArg?.trim().toLowerCase());
if (!email.success) {
  console.error('Usage: npm run add-admin -- you@waypointconnect.org "Your Name"');
  process.exit(1);
}
const fullName = nameParts.join(" ").trim();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
const db = createClient<Database>(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: existing } = await db.from("profiles").select("id, role").eq("email", email.data!).maybeSingle();
  if (existing) {
    await db.from("profiles").update({ role: "admin", mfa_required: true, active: true }).eq("id", existing.id);
    console.log(`${email.data} already had an account. It's now an Admin.`);
    return;
  }
  await db
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("email", email.data!)
    .is("accepted_at", null)
    .is("revoked_at", null);
  const { error } = await db.from("invitations").insert({ email: email.data!, full_name: fullName || null, role: "admin" });
  if (error) throw new Error(error.message);
  console.log(`Invited ${email.data} as an Admin. Go to the sign-in page and ask for a link with that email.`);
  console.log("You'll be asked to set up two-step sign-in with an authenticator app the first time.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
