import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Mail, Phone, Trash2, UsersRound } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { NewContactButton } from "@/components/contacts/new-contact-button";
import { ActivityTimeline } from "@/components/records/activity-timeline";
import { CustomFields } from "@/components/records/custom-fields";
import { InlineSelect, InlineText } from "@/components/records/inline-field";
import { RecordActions } from "@/components/records/record-actions";
import { TagEditor } from "@/components/records/tag-editor";
import { requireRole } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCustomFieldDefinitions, getTimeline, logView } from "@/lib/data/records";
import { displayName, formatDate, formatPhone, ORGANISATION_TYPE_LABELS } from "@/lib/format";
import { AU_STATES, ORGANISATION_TYPES } from "@/lib/validation/contacts";

export const metadata: Metadata = { title: "Organisation" };

export default async function OrganisationPage({ params }: PageProps<"/organisations/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { profile } = await requireRole("admin", "manager", "bizdev");

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organisations")
    .select("*, organisation_tags(tags(id, name))")
    .eq("id", id)
    .maybeSingle();
  if (!org) notFound();

  const [timeline, customDefs, { data: people }] = await Promise.all([
    getTimeline("organisation", id),
    getCustomFieldDefinitions("organisation"),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, preferred_name, job_title, mobile, email")
      .eq("organisation_id", id)
      .is("deleted_at", null)
      .order("last_name"),
    logView("organisations", id),
  ]);

  const editable = can.editContacts(profile.role) && !org.deleted_at;
  const tags = org.organisation_tags.flatMap((ot) => (ot.tags ? [ot.tags] : []));
  const common = { kind: "organisation" as const, recordId: id, canEdit: editable };

  return (
    <div className="mx-auto max-w-6xl">
      <Button asChild variant="link" className="mb-2 px-0">
        <Link href="/contacts?tab=organisations">
          <ArrowLeft aria-hidden /> All organisations
        </Link>
      </Button>

      {org.deleted_at && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50">
          <Trash2 className="size-5" aria-hidden />
          This organisation is in the bin (since {formatDate(org.deleted_at)}). Restore it to make changes.
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-3xl font-extrabold break-words">{org.name}</h1>
          <p className="text-lg text-muted-foreground">
            {ORGANISATION_TYPE_LABELS[org.type]}
            {org.suburb ? ` · ${org.suburb}` : ""}
          </p>
          <TagEditor kind="organisation" recordId={id} initial={tags} canEdit={editable} />
        </div>
        <div className="flex flex-wrap gap-2">
          {org.phone && (
            <Button asChild variant="outline">
              <a href={`tel:${org.phone.replace(/\s/g, "")}`}>
                <Phone aria-hidden /> Call
              </a>
            </Button>
          )}
          {org.email && (
            <Button asChild variant="outline">
              <a href={`mailto:${org.email}`}>
                <Mail aria-hidden /> Email
              </a>
            </Button>
          )}
          {org.website && (
            <Button asChild variant="outline">
              <a href={org.website} target="_blank" rel="noopener noreferrer">
                <Globe aria-hidden /> Website<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          )}
          <RecordActions
            kind="organisation"
            recordId={id}
            name={org.name}
            deleted={Boolean(org.deleted_at)}
            canDelete={can.deleteContacts(profile.role)}
            canMerge={false}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-semibold text-muted-foreground">Name</dt>
                  <dd>
                    <InlineText {...common} field="name" label="Name" value={org.name} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-muted-foreground">Type</dt>
                  <dd className="mt-1">
                    <InlineSelect
                      {...common}
                      field="type"
                      label="Type"
                      value={org.type}
                      options={ORGANISATION_TYPES.map((t) => ({ value: t, label: ORGANISATION_TYPE_LABELS[t] }))}
                    />
                  </dd>
                </div>
                {(
                  [
                    ["phone", "Phone", org.phone, "tel"],
                    ["email", "Email", org.email, "email"],
                    ["website", "Website", org.website, "url"],
                    ["abn", "ABN", org.abn, "text"],
                    ["address_line", "Street address", org.address_line, "text"],
                    ["suburb", "Suburb", org.suburb, "text"],
                    ["postcode", "Postcode", org.postcode, "text"],
                  ] as const
                ).map(([field, label, value, type]) => (
                  <div key={field}>
                    <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
                    <dd>
                      <InlineText
                        {...common}
                        field={field}
                        label={label}
                        value={value}
                        type={type}
                        display={type === "tel" ? formatPhone(value) : undefined}
                      />
                    </dd>
                  </div>
                ))}
                <div>
                  <dt className="text-sm font-semibold text-muted-foreground">State</dt>
                  <dd className="mt-1">
                    <InlineSelect {...common} field="state" label="State" value={org.state} options={AU_STATES.map((s) => ({ value: s, label: s }))} />
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {customDefs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">More details</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomFields
                  kind="organisation"
                  recordId={id}
                  definitions={customDefs}
                  values={(org.custom_fields ?? {}) as Record<string, unknown>}
                  canEdit={editable}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <InlineText {...common} field="notes" label="Notes" value={org.notes} multiline placeholder="Add notes about this organisation" />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <section aria-labelledby="people-heading" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 id="people-heading" className="text-lg font-bold">
                People ({people?.length ?? 0})
              </h2>
              {editable && <NewContactButton label="Add a person" organisationId={id} />}
            </div>
            {people && people.length > 0 ? (
              <ul className="divide-y rounded-xl border bg-card">
                {people.map((p) => (
                  <li key={p.id}>
                    <Link href={`/contacts/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-muted/50">
                      <span>
                        <span className="block font-semibold">{displayName(p)}</span>
                        {p.job_title && <span className="block text-sm text-muted-foreground">{p.job_title}</span>}
                      </span>
                      <span className="tabular text-sm text-muted-foreground">{formatPhone(p.mobile) || p.email}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={UsersRound} title="No people linked yet" compact>
                Add the coordinators, managers and other staff you deal with here.
              </EmptyState>
            )}
          </section>

          <ActivityTimeline subjectType="organisation" subjectId={id} items={timeline} canLog={!org.deleted_at} />
        </div>
      </div>
    </div>
  );
}
