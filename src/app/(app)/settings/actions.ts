"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyDbError, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { publicEnv } from "@/lib/env";
import type { AppRole } from "@/lib/database.types";

const ROLES = ["admin", "manager", "bizdev", "support"] as const satisfies readonly AppRole[];

// ---------------------------------------------------------------------------
// Your profile
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Please add your name.").max(100),
  preferred_name: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .max(30)
    .transform((v) => v || null),
});

export async function updateMyProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const user = await actionUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/", "layout");
  return ok(undefined, "Profile saved.");
}

/** Turn off your own two-step sign-in (only if your role doesn't require it). */
export async function removeMyMfa(): Promise<ActionResult> {
  const user = await actionUser();
  if (user.profile.mfa_required) return fail("Your account requires two-step sign-in, so it can't be turned off.");
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id });
  revalidatePath("/settings");
  return ok(undefined, "Two-step sign-in turned off.");
}

// ---------------------------------------------------------------------------
// Team (Admins only)
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.email("That doesn't look like an email address.").transform((v) => v.trim().toLowerCase()),
  full_name: z.string().trim().min(1, "Add their name so the team knows who they are.").max(100),
  role: z.enum(ROLES),
});

export async function inviteUser(input: z.input<typeof inviteSchema>): Promise<ActionResult> {
  const admin = await actionUser("admin");
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { email, full_name, role } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return fail(`${email} already has an account.`);

  // Replace any earlier pending invitation for the same email.
  await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null);

  const { error } = await supabase.from("invitations").insert({ email, full_name, role, invited_by: admin.id });
  if (error) return fail(friendlyDbError(error));

  // Sends the invitation email. The auth hook allows it because the invitation now exists.
  const { error: inviteError } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    data: { full_name },
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/today`,
  });
  if (inviteError) {
    // The invitation still stands: they can sign in with "email me a link" on the login page.
    await supabase.rpc("write_audit", { p_action: "invite", p_entity_type: "invitations", p_details: { role, emailed: false } });
    revalidatePath("/settings");
    return ok(undefined, `Invitation saved, but the email didn't send. ${full_name} can go to the sign-in page and ask for a link.`);
  }

  await supabase.rpc("write_audit", { p_action: "invite", p_entity_type: "invitations", p_details: { role, emailed: true } });
  revalidatePath("/settings");
  return ok(undefined, `Invitation sent to ${full_name}. They'll get an email with a sign-in link.`);
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  await actionUser("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/settings");
  return ok(undefined, "Invitation cancelled.");
}

export async function changeRole(userId: string, role: AppRole): Promise<ActionResult> {
  await actionUser("admin");
  if (!ROLES.includes(role)) return fail("That role doesn't exist.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, ...(role === "admin" ? { mfa_required: true } : {}) })
    .eq("id", userId);
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/settings");
  return ok(undefined, "Role updated.");
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const me = await actionUser("admin");
  if (userId === me.id && !active) return fail("You can't deactivate yourself. Ask another Admin.");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ active }).eq("id", userId);
  if (error) return fail(friendlyDbError(error));
  // Block (or unblock) sign-in at the auth level too, which also ends their sessions.
  await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  revalidatePath("/settings");
  return ok(undefined, active ? "Access restored." : "Access removed. They've been signed out everywhere.");
}

export async function setMfaRequired(userId: string, required: boolean): Promise<ActionResult> {
  await actionUser("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ mfa_required: required }).eq("id", userId);
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/settings");
  return ok(undefined, required ? "Two-step sign-in is now required for them." : "Two-step sign-in is now optional for them.");
}

/** For a lost phone: removes their authenticator so they can set it up again next sign-in. */
export async function resetUserMfa(userId: string): Promise<ActionResult> {
  await actionUser("admin");
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) return fail("Couldn't reset two-step sign-in. Please try again.");
  for (const f of data?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: "update",
    p_entity_type: "profiles",
    p_entity_id: userId,
    p_changed_fields: ["mfa_factors"],
  });
  revalidatePath("/settings");
  return ok(undefined, "Two-step sign-in reset. They'll set it up again next time they sign in.");
}

// ---------------------------------------------------------------------------
// Tags and custom fields (Admins and Managers)
// ---------------------------------------------------------------------------

export async function renameTag(id: string, name: string): Promise<ActionResult> {
  await actionUser("admin", "manager");
  const parsed = z.string().trim().min(1).max(40).safeParse(name);
  if (!parsed.success) return fail("Tags need a short name.");
  const supabase = await createClient();
  const { error } = await supabase.from("tags").update({ name: parsed.data }).eq("id", id);
  if (error) return fail(error.code === "23505" ? "There's already a tag with that name." : friendlyDbError(error));
  revalidatePath("/settings");
  return ok(undefined, "Tag renamed.");
}

export async function deleteTag(id: string): Promise<ActionResult> {
  await actionUser("admin", "manager");
  const supabase = await createClient();
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/settings");
  return ok(undefined, "Tag removed from everyone who had it.");
}

const customFieldSchema = z
  .object({
    entity: z.enum(["contact", "organisation"]),
    label: z.string().trim().min(1, "Give the field a name.").max(60),
    field_type: z.enum(["text", "number", "date", "select", "checkbox"]),
    options: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  })
  .refine((v) => v.field_type !== "select" || v.options.length >= 2, {
    message: "A dropdown needs at least two options.",
    path: ["options"],
  });

export async function addCustomField(input: z.input<typeof customFieldSchema>): Promise<ActionResult> {
  await actionUser("admin", "manager");
  const parsed = customFieldSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const key =
    parsed.data.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "f_$1")
      .slice(0, 40) || "field";
  const supabase = await createClient();
  const { count } = await supabase
    .from("custom_field_definitions")
    .select("id", { count: "exact", head: true })
    .eq("entity", parsed.data.entity);
  const { error } = await supabase.from("custom_field_definitions").insert({
    ...parsed.data,
    key,
    options: parsed.data.field_type === "select" ? parsed.data.options : [],
    position: count ?? 0,
  });
  if (error) return fail(error.code === "23505" ? "There's already a field with that name." : friendlyDbError(error));
  revalidatePath("/settings");
  return ok(undefined, `"${parsed.data.label}" added.`);
}

export async function archiveCustomField(id: string, archived: boolean): Promise<ActionResult> {
  await actionUser("admin", "manager");
  const supabase = await createClient();
  const { error } = await supabase.from("custom_field_definitions").update({ archived }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/settings");
  return ok(undefined, archived ? "Field hidden. Existing answers are kept." : "Field shown again.");
}
