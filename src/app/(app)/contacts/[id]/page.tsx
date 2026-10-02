import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, Mail, Phone, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityTimeline } from "@/components/records/activity-timeline";
import { CustomFields } from "@/components/records/custom-fields";
import { InlineSelect, InlineSwitch, InlineText } from "@/components/records/inline-field";
import { RecordActions } from "@/components/records/record-actions";
import { TagEditor } from "@/components/records/tag-editor";
import { ContactOrganisationField } from "./organisation-field";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCustomFieldDefinitions, getTimeline, logView } from "@/lib/data/records";
import { displayName, formatDate, formatDateTime, formatPhone } from "@/lib/format";
import { AU_STATES } from "@/lib/validation/contacts";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { profile } = await requireUser();

  const supabase = await createClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("*, organisations(id, name), contact_tags(tags(id, name))")
    .eq("id", id)
    .maybeSingle();
  // RLS hides records someone can't see, so "not found" covers "not allowed" too.
  if (!contact) notFound();

  const [timeline, customDefs] = await Promise.all([
    getTimeline("contact", id),
    getCustomFieldDefinitions("contact"),
    logView("contacts", id),
  ]);

  const editable = can.editContacts(profile.role) && !contact.deleted_at;
  const name = displayName(contact);
  const tags = contact.contact_tags.flatMap((ct) => (ct.tags ? [ct.tags] : []));
  const common = { kind: "contact" as const, recordId: id, canEdit: editable };

  return (
    <div className="mx-auto max-w-6xl">
      <Button asChild variant="link" className="mb-2 px-0">
        <Link href="/contacts">
          <ArrowLeft aria-hidden /> All contacts
        </Link>
      </Button>

      {contact.deleted_at && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50">
          <Trash2 className="size-5" aria-hidden />
          This contact is in the bin (since {formatDate(contact.deleted_at)}). Restore it to make changes.
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-3xl font-extrabold break-words">{name}</h1>
          {(contact.job_title || contact.organisations) && (
            <p className="text-lg text-muted-foreground">
              {contact.job_title}
              {contact.job_title && contact.organisations ? " at " : ""}
              {contact.organisations && (
                <Link href={`/organisations/${contact.organisations.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                  {contact.organisations.name}
                </Link>
              )}
            </p>
          )}
          <TagEditor kind="contact" recordId={id} initial={tags} canEdit={editable} />
          {contact.do_not_contact && (
            <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-50">
              <Ban className="size-4" aria-hidden /> Do not contact
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {contact.mobile && !contact.do_not_contact && (
            <Button asChild variant="outline">
              <a href={`tel:${contact.mobile.replace(/\s/g, "")}`}>
                <Phone aria-hidden /> Call
              </a>
            </Button>
          )}
          {contact.email && !contact.do_not_contact && !contact.email_opt_out && (
            <Button asChild variant="outline">
              <a href={`mailto:${contact.email}`}>
                <Mail aria-hidden /> Email
              </a>
            </Button>
          )}
          <RecordActions
            kind="contact"
            recordId={id}
            name={name}
            deleted={Boolean(contact.deleted_at)}
            canDelete={can.deleteContacts(profile.role)}
            canMerge={can.mergeContacts(profile.role)}
            self={{ id, first_name: contact.first_name, last_name: contact.last_name, email: contact.email, mobile: contact.mobile }}
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
                {(
                  [
                    ["first_name", "First name", contact.first_name, "text"],
                    ["last_name", "Last name", contact.last_name, "text"],
                    ["preferred_name", "Preferred name", contact.preferred_name, "text"],
                    ["mobile", "Mobile", contact.mobile, "tel"],
                    ["phone", "Other phone", contact.phone, "tel"],
                    ["email", "Email", contact.email, "email"],
                    ["job_title", "Job title", contact.job_title, "text"],
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
                  <dt className="text-sm font-semibold text-muted-foreground">Organisation</dt>
                  <dd className="mt-1">
                    <ContactOrganisationField
                      contactId={id}
                      value={contact.organisation_id}
                      label={contact.organisations?.name ?? null}
                      canEdit={editable}
                    />
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Address</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[1fr_6rem] gap-x-3 gap-y-3">
                <div className="col-span-2">
                  <dt className="text-sm font-semibold text-muted-foreground">Street</dt>
                  <dd>
                    <InlineText {...common} field="address_line" label="Street address" value={contact.address_line} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-muted-foreground">Suburb</dt>
                  <dd>
                    <InlineText {...common} field="suburb" label="Suburb" value={contact.suburb} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-muted-foreground">Postcode</dt>
                  <dd>
                    <InlineText {...common} field="postcode" label="Postcode" value={contact.postcode} />
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-sm font-semibold text-muted-foreground">State</dt>
                  <dd className="mt-1">
                    <InlineSelect
                      {...common}
                      field="state"
                      label="State"
                      value={contact.state}
                      options={AU_STATES.map((s) => ({ value: s, label: s }))}
                    />
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InlineSwitch
                {...common}
                field="do_not_contact"
                label="Do not contact"
                description="Nobody should call, email or text them."
                value={contact.do_not_contact}
                onLabel="Marked as do not contact"
              />
              <InlineSwitch
                {...common}
                field="email_opt_out"
                label="No marketing emails"
                description="Excluded from newsletters and bulk email."
                value={contact.email_opt_out}
              />
              <InlineSwitch
                {...common}
                field="sms_opt_out"
                label="No marketing SMS"
                description="Excluded from bulk SMS."
                value={contact.sms_opt_out}
              />
            </CardContent>
          </Card>

          {customDefs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">More details</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomFields
                  kind="contact"
                  recordId={id}
                  definitions={customDefs}
                  values={(contact.custom_fields ?? {}) as Record<string, unknown>}
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
              <InlineText {...common} field="notes" label="Notes" value={contact.notes} multiline placeholder="Add relationship notes" />
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">
            Added {formatDateTime(contact.created_at)} · Updated {formatDateTime(contact.updated_at)}
          </p>
        </div>

        <ActivityTimeline subjectType="contact" subjectId={id} items={timeline} canLog={!contact.deleted_at} />
      </div>
    </div>
  );
}
