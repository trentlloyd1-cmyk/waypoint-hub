"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyDbError, ok, zodFail, type ActionResult } from "@/lib/action-result";
import {
  activityNoteSchema,
  contactSchema,
  CONTACT_INLINE_FIELDS,
  organisationSchema,
  ORGANISATION_INLINE_FIELDS,
  tagNameSchema,
  type ContactInput,
  type OrganisationInput,
} from "@/lib/validation/contacts";
import type { Database } from "@/lib/database.types";

const GROWTH = ["admin", "manager", "bizdev"] as const;
const MANAGEMENT = ["admin", "manager"] as const;

type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];
type OrganisationUpdate = Database["public"]["Tables"]["organisations"]["Update"];

export type DuplicateMatch = Database["public"]["Functions"]["find_contact_duplicates"]["Returns"][number];

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function checkContactDuplicates(input: {
  first_name: string;
  last_name?: string;
  email?: string | null;
  mobile?: string | null;
  phone?: string | null;
  exclude?: string;
}): Promise<DuplicateMatch[]> {
  await actionUser(...GROWTH);
  if (!input.first_name?.trim()) return [];
  const supabase = await createClient();
  const phones = [input.mobile, input.phone].filter(Boolean) as string[];
  const results = new Map<string, DuplicateMatch>();
  for (const phone of phones.length ? phones : [null]) {
    const { data } = await supabase.rpc("find_contact_duplicates", {
      p_first_name: input.first_name,
      p_last_name: input.last_name ?? "",
      p_email: input.email || null,
      p_phone: phone,
      p_exclude: input.exclude ?? null,
    });
    data?.forEach((d) => results.set(d.id, d));
  }
  return [...results.values()];
}

export async function createContact(
  input: ContactInput,
  opts: { tagIds?: string[]; allowDuplicate?: boolean } = {},
): Promise<ActionResult<{ id: string; duplicates?: DuplicateMatch[] }>> {
  const user = await actionUser(...GROWTH);
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  if (!opts.allowDuplicate) {
    const duplicates = await checkContactDuplicates(parsed.data);
    if (duplicates.length) {
      return ok({ id: "", duplicates }, "This might already be in Waypoint Hub.");
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("contacts").insert(parsed.data).select("id").single();
  if (error || !data) return fail(friendlyDbError(error));

  if (opts.tagIds?.length) {
    await supabase.from("contact_tags").insert(opts.tagIds.map((tag_id) => ({ contact_id: data.id, tag_id })));
  }
  await supabase.from("activities").insert({
    subject_type: "contact",
    subject_id: data.id,
    type: "system",
    body: "Added to Waypoint Hub",
    actor_id: user.id,
  });

  revalidatePath("/contacts");
  revalidatePath("/today");
  return ok({ id: data.id }, `Nice, ${parsed.data.first_name} is in.`);
}

export async function updateContactField(
  id: string,
  field: string,
  value: unknown,
): Promise<ActionResult<{ value: unknown }>> {
  await actionUser();
  if (!(CONTACT_INLINE_FIELDS as readonly string[]).includes(field)) return fail("That field can't be edited here.");
  const shape = contactSchema.shape[field as keyof typeof contactSchema.shape];
  const parsed = shape.safeParse(value);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That value isn't quite right.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ [field]: parsed.data ?? null } as ContactUpdate)
    .eq("id", z.uuid().parse(id));
  if (error) return fail(friendlyDbError(error));

  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
  return ok({ value: parsed.data ?? null });
}

/** Saves one custom field, checking it against its definition (type and allowed options). */
export async function updateCustomField(
  kind: "contact" | "organisation",
  id: string,
  key: string,
  value: unknown,
): Promise<ActionResult> {
  await actionUser(...GROWTH);
  const supabase = await createClient();
  const { data: def } = await supabase
    .from("custom_field_definitions")
    .select("field_type, options, label")
    .eq("entity", kind)
    .eq("key", key)
    .eq("archived", false)
    .maybeSingle();
  if (!def) return fail("That field no longer exists. Refresh the page.");

  const valueSchema = {
    text: z.string().trim().max(500),
    number: z.coerce.number({ error: "Enter a number." }),
    date: z.iso.date("Pick a date."),
    select: z.enum(def.options.length ? (def.options as [string, ...string[]]) : [""], { error: "Pick one of the options." }),
    checkbox: z.boolean(),
  }[def.field_type];
  const parsed = value === "" || value === null ? { success: true as const, data: null } : valueSchema.safeParse(value);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? `${def.label} isn't quite right.`);

  const table = kind === "contact" ? "contacts" : "organisations";
  const { data: row, error } = await supabase.from(table).select("custom_fields").eq("id", id).single();
  if (error || !row) return fail(friendlyDbError(error));
  const next = { ...((row.custom_fields ?? {}) as Record<string, unknown>), [key]: parsed.data };
  const { error: updateError } = await supabase
    .from(table)
    .update({ custom_fields: next as Database["public"]["Tables"]["contacts"]["Update"]["custom_fields"] })
    .eq("id", id);
  if (updateError) return fail(friendlyDbError(updateError));
  revalidatePath(kind === "contact" ? `/contacts/${id}` : `/organisations/${id}`);
  return ok(undefined, `${def.label} saved`);
}

export async function deleteContact(id: string): Promise<ActionResult> {
  await actionUser(...MANAGEMENT);
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/contacts");
  return ok(undefined, "Moved to the bin. You can restore it from the bin for 30 days.");
}

export async function restoreContact(id: string): Promise<ActionResult> {
  await actionUser(...MANAGEMENT);
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update({ deleted_at: null }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  return ok(undefined, "Restored. Welcome back!");
}

export async function mergeContacts(keepId: string, mergeId: string): Promise<ActionResult> {
  await actionUser(...MANAGEMENT);
  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_contacts", { p_keep: keepId, p_merge: mergeId });
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${keepId}`);
  return ok(undefined, "Merged. One tidy record, all the history in one place.");
}

// ---------------------------------------------------------------------------
// Organisations
// ---------------------------------------------------------------------------

export async function createOrganisation(
  input: OrganisationInput,
  opts: { tagIds?: string[] } = {},
): Promise<ActionResult<{ id: string }>> {
  const user = await actionUser(...GROWTH);
  const parsed = organisationSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("organisations")
    .select("id")
    .ilike("name", parsed.data.name)
    .is("deleted_at", null)
    .limit(1);
  if (existing?.length) return fail(`${parsed.data.name} is already in Waypoint Hub.`, { name: "Already added" });

  const { data, error } = await supabase.from("organisations").insert(parsed.data).select("id").single();
  if (error || !data) return fail(friendlyDbError(error));

  if (opts.tagIds?.length) {
    await supabase
      .from("organisation_tags")
      .insert(opts.tagIds.map((tag_id) => ({ organisation_id: data.id, tag_id })));
  }
  await supabase.from("activities").insert({
    subject_type: "organisation",
    subject_id: data.id,
    type: "system",
    body: "Added to Waypoint Hub",
    actor_id: user.id,
  });

  revalidatePath("/contacts");
  return ok({ id: data.id }, `${parsed.data.name} added. Nice one.`);
}

export async function updateOrganisationField(
  id: string,
  field: string,
  value: unknown,
): Promise<ActionResult<{ value: unknown }>> {
  await actionUser(...GROWTH);
  if (!(ORGANISATION_INLINE_FIELDS as readonly string[]).includes(field)) return fail("That field can't be edited here.");
  const shape = organisationSchema.shape[field as keyof typeof organisationSchema.shape];
  const parsed = shape.safeParse(value);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That value isn't quite right.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("organisations")
    .update({ [field]: parsed.data ?? null } as OrganisationUpdate)
    .eq("id", z.uuid().parse(id));
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/organisations/${id}`);
  revalidatePath("/contacts");
  return ok({ value: parsed.data ?? null });
}

export async function deleteOrganisation(id: string): Promise<ActionResult> {
  await actionUser(...MANAGEMENT);
  const supabase = await createClient();
  const { error } = await supabase.from("organisations").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/contacts");
  return ok(undefined, "Moved to the bin. You can restore it from the bin for 30 days.");
}

export async function restoreOrganisation(id: string): Promise<ActionResult> {
  await actionUser(...MANAGEMENT);
  const supabase = await createClient();
  const { error } = await supabase.from("organisations").update({ deleted_at: null }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/contacts");
  revalidatePath(`/organisations/${id}`);
  return ok(undefined, "Restored. Welcome back!");
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

/** Find a tag by name, or create it. Returns its id. */
export async function ensureTag(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  await actionUser(...GROWTH);
  const parsed = tagNameSchema.safeParse(name);
  if (!parsed.success) return fail("Tags need a short name.");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("tags").select("id, name").ilike("name", parsed.data).maybeSingle();
  if (existing) return ok(existing);
  const { data, error } = await supabase.from("tags").insert({ name: parsed.data }).select("id, name").single();
  if (error || !data) return fail(friendlyDbError(error));
  return ok(data);
}

export async function setRecordTag(
  kind: "contact" | "organisation",
  recordId: string,
  tagId: string,
  on: boolean,
): Promise<ActionResult> {
  await actionUser(...GROWTH);
  const supabase = await createClient();
  const { error } =
    kind === "contact"
      ? on
        ? await supabase.from("contact_tags").upsert({ contact_id: recordId, tag_id: tagId })
        : await supabase.from("contact_tags").delete().match({ contact_id: recordId, tag_id: tagId })
      : on
        ? await supabase.from("organisation_tags").upsert({ organisation_id: recordId, tag_id: tagId })
        : await supabase.from("organisation_tags").delete().match({ organisation_id: recordId, tag_id: tagId });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(kind === "contact" ? `/contacts/${recordId}` : `/organisations/${recordId}`);
  revalidatePath("/contacts");
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Activity timeline
// ---------------------------------------------------------------------------

const NOTE_MESSAGES = {
  call: "Call logged. Thanks for keeping the timeline up to date!",
  note: "Note saved.",
  meeting: "Meeting logged.",
  email: "Email logged.",
  sms: "SMS logged.",
} as const;

export async function logActivity(input: z.input<typeof activityNoteSchema>): Promise<ActionResult> {
  const user = await actionUser();
  const parsed = activityNoteSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({
    subject_type: parsed.data.subject_type,
    subject_id: parsed.data.subject_id,
    type: parsed.data.type,
    body: parsed.data.body,
    occurred_at: parsed.data.occurred_at ?? new Date().toISOString(),
    actor_id: user.id,
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(parsed.data.subject_type === "contact" ? `/contacts/${parsed.data.subject_id}` : `/organisations/${parsed.data.subject_id}`);
  return ok(undefined, NOTE_MESSAGES[parsed.data.type]);
}
