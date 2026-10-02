"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/server-env";
import { safeNextPath } from "@/lib/routes";
import { TEST_USERS } from "@/lib/test-users";

/**
 * DEVELOPMENT ONLY: sign in as one of the seeded fake test users without email.
 * Refuses to run unless ENABLE_DEV_LOGIN=true and the app isn't a production build.
 */
export async function devSignIn(formData: FormData) {
  if (!serverEnv().ENABLE_DEV_LOGIN) throw new Error("Not available");

  const email = String(formData.get("email") ?? "");
  if (!TEST_USERS.some((u) => u.email === email)) throw new Error("Only seeded test users can use this.");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error("Couldn't create a test sign-in. Has the seed script run?");

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) throw new Error(verifyError.message);

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}
