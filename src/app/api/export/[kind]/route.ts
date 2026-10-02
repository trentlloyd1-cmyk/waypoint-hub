import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, needsMfaStep } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { ORGANISATION_TYPE_LABELS } from "@/lib/format";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/** CSV export of contacts or organisations. Admin/Manager only, and every export is audit-logged. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/export/[kind]">) {
  const { kind } = await ctx.params;
  if (kind !== "contacts" && kind !== "organisations") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await getCurrentUser();
  if (!user || needsMfaStep(user)) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!can.exportData(user.profile.role)) {
    return NextResponse.json({ error: "Only Admins and Managers can export data." }, { status: 403 });
  }

  const supabase = await createClient();
  const stamp = format(new TZDate(new Date(), "Australia/Brisbane"), "yyyy-MM-dd");
  let csv: string;
  let count = 0;

  if (kind === "contacts") {
    const { data, error } = await supabase
      .from("contacts")
      .select("*, organisations(name), contact_tags(tags(name))")
      .is("deleted_at", null)
      .order("last_name");
    if (error) return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
    count = data.length;
    csv = toCsv(
      data.map((c) => ({
        ...c,
        organisation: c.organisations?.name,
        tags: c.contact_tags.flatMap((ct) => (ct.tags ? [ct.tags.name] : [])),
        do_not_contact: c.do_not_contact ? "Yes" : "",
        email_opt_out: c.email_opt_out ? "Yes" : "",
        sms_opt_out: c.sms_opt_out ? "Yes" : "",
      })),
      [
        { key: "first_name", header: "First name" },
        { key: "last_name", header: "Last name" },
        { key: "preferred_name", header: "Preferred name" },
        { key: "email", header: "Email" },
        { key: "mobile", header: "Mobile" },
        { key: "phone", header: "Phone" },
        { key: "organisation", header: "Organisation" },
        { key: "job_title", header: "Job title" },
        { key: "address_line", header: "Street address" },
        { key: "suburb", header: "Suburb" },
        { key: "state", header: "State" },
        { key: "postcode", header: "Postcode" },
        { key: "tags", header: "Tags" },
        { key: "do_not_contact", header: "Do not contact" },
        { key: "email_opt_out", header: "No marketing email" },
        { key: "sms_opt_out", header: "No marketing SMS" },
        { key: "notes", header: "Notes" },
      ],
    );
  } else {
    const { data, error } = await supabase
      .from("organisations")
      .select("*, organisation_tags(tags(name))")
      .is("deleted_at", null)
      .order("name");
    if (error) return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
    count = data.length;
    csv = toCsv(
      data.map((o) => ({
        ...o,
        type: ORGANISATION_TYPE_LABELS[o.type],
        tags: o.organisation_tags.flatMap((ot) => (ot.tags ? [ot.tags.name] : [])),
      })),
      [
        { key: "name", header: "Name" },
        { key: "type", header: "Type" },
        { key: "abn", header: "ABN" },
        { key: "phone", header: "Phone" },
        { key: "email", header: "Email" },
        { key: "website", header: "Website" },
        { key: "address_line", header: "Street address" },
        { key: "suburb", header: "Suburb" },
        { key: "state", header: "State" },
        { key: "postcode", header: "Postcode" },
        { key: "tags", header: "Tags" },
        { key: "notes", header: "Notes" },
      ],
    );
  }

  await supabase.rpc("write_audit", {
    p_action: "export",
    p_entity_type: kind,
    p_details: { format: "csv", rows: count },
  });

  return csvResponse(csv, `waypoint-hub-${kind}-${stamp}.csv`);
}
