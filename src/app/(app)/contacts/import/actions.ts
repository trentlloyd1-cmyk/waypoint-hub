"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { contactFormSchema } from "@/lib/validation/contacts";

import type { ImportRow } from "./import-fields";

export type ImportSummary = {
  added: number;
  organisationsCreated: number;
  skipped: { row: number; name: string; reason: string }[];
};

const MAX_ROWS = 2000;

const normPhone = (p?: string | null) => (p ? p.replace(/\D/g, "").replace(/^61/, "0") : "");

/**
 * Bulk-adds contacts from a spreadsheet. Skips rows that fail validation or match an existing
 * contact's email or phone, and reports why, row by row.
 */
export async function importContacts(
  rows: ImportRow[],
  opts: { tagName?: string; createOrganisations: boolean },
): Promise<ActionResult<ImportSummary>> {
  const user = await actionUser("admin", "manager", "bizdev");
  if (!Array.isArray(rows) || rows.length === 0) return fail("There are no rows to import.");
  if (rows.length > MAX_ROWS) return fail(`That's a big file! Please split it into files of ${MAX_ROWS} rows or fewer.`);

  const supabase = await createClient();
  const summary: ImportSummary = { added: 0, organisationsCreated: 0, skipped: [] };

  // Existing contacts' emails and phones, for duplicate checks.
  const { data: existing } = await supabase
    .from("contacts")
    .select("email, mobile_norm, phone_norm")
    .is("deleted_at", null);
  const seenEmails = new Set((existing ?? []).map((c) => c.email?.toLowerCase()).filter(Boolean));
  const seenPhones = new Set((existing ?? []).flatMap((c) => [c.mobile_norm, c.phone_norm]).filter(Boolean));

  // Organisations by lower-case name.
  const { data: orgs } = await supabase.from("organisations").select("id, name").is("deleted_at", null);
  const orgByName = new Map((orgs ?? []).map((o) => [o.name.trim().toLowerCase(), o.id]));

  let tagId: string | null = null;
  if (opts.tagName?.trim()) {
    const name = z.string().trim().min(1).max(40).parse(opts.tagName);
    const { data: tag } = await supabase.from("tags").select("id").ilike("name", name).maybeSingle();
    tagId = tag?.id ?? (await supabase.from("tags").insert({ name }).select("id").single()).data?.id ?? null;
  }

  const toInsert: z.output<typeof contactFormSchema>[] = [];
  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2; // +1 for the header row, +1 because spreadsheets count from 1
    const label = [row.first_name, row.last_name].filter(Boolean).join(" ") || `Row ${rowNumber}`;

    let organisation_id: string | null = null;
    const orgName = row.organisation_name?.trim();
    if (orgName) {
      organisation_id = orgByName.get(orgName.toLowerCase()) ?? null;
      if (!organisation_id && opts.createOrganisations) {
        const { data: created } = await supabase.from("organisations").insert({ name: orgName }).select("id").single();
        if (created) {
          organisation_id = created.id;
          orgByName.set(orgName.toLowerCase(), created.id);
          summary.organisationsCreated++;
        }
      }
    }

    const parsed = contactFormSchema.safeParse({
      ...row,
      state: row.state?.trim().toUpperCase() || null,
      organisation_id,
    });
    if (!parsed.success) {
      summary.skipped.push({ row: rowNumber, name: label, reason: parsed.error.issues[0]?.message ?? "Invalid data" });
      continue;
    }

    const email = parsed.data.email?.toLowerCase();
    const phones = [normPhone(parsed.data.mobile), normPhone(parsed.data.phone)].filter(Boolean);
    if (email && seenEmails.has(email)) {
      summary.skipped.push({ row: rowNumber, name: label, reason: "Someone with this email is already in Waypoint Hub" });
      continue;
    }
    if (phones.some((p) => seenPhones.has(p))) {
      summary.skipped.push({ row: rowNumber, name: label, reason: "Someone with this phone number is already in Waypoint Hub" });
      continue;
    }
    if (email) seenEmails.add(email);
    phones.forEach((p) => seenPhones.add(p));
    toInsert.push(parsed.data);
  }

  // Insert in batches of 200.
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200);
    const { data, error } = await supabase.from("contacts").insert(batch).select("id");
    if (error || !data) {
      batch.forEach((c) =>
        summary.skipped.push({ row: 0, name: `${c.first_name} ${c.last_name}`.trim(), reason: "Couldn't be saved. Try again." }),
      );
      continue;
    }
    summary.added += data.length;
    if (tagId) await supabase.from("contact_tags").insert(data.map((d) => ({ contact_id: d.id, tag_id: tagId })));
    await supabase.from("activities").insert(
      data.map((d) => ({
        subject_type: "contact" as const,
        subject_id: d.id,
        type: "system" as const,
        body: "Imported from a spreadsheet",
        actor_id: user.id,
      })),
    );
  }

  await supabase.rpc("write_audit", {
    p_action: "import",
    p_entity_type: "contacts",
    p_details: { rows: rows.length, added: summary.added, skipped: summary.skipped.length },
  });

  revalidatePath("/contacts");
  revalidatePath("/today");
  return ok(summary);
}
