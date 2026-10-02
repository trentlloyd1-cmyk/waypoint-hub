"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { OrganisationSelect } from "@/components/contacts/organisation-select";
import { updateContactField } from "../actions";

/** Change which organisation a contact belongs to. */
export function ContactOrganisationField({
  contactId,
  value,
  label,
  canEdit,
}: {
  contactId: string;
  value: string | null;
  label: string | null;
  canEdit: boolean;
}) {
  const [current, setCurrent] = useState(value);
  const [, startTransition] = useTransition();

  if (!canEdit) {
    return value && label ? (
      <Link href={`/organisations/${value}`} className="font-semibold text-primary hover:underline">
        {label}
      </Link>
    ) : (
      <span className="text-muted-foreground">Not added</span>
    );
  }

  return (
    <OrganisationSelect
      aria-label="Organisation"
      value={current}
      initialLabel={label}
      onChange={(id, name) =>
        startTransition(async () => {
          const previous = current;
          setCurrent(id);
          const result = await updateContactField(contactId, "organisation_id", id);
          if (!result.ok) {
            setCurrent(previous);
            toast.error(result.error);
          } else toast.success(name ? `Now linked to ${name}` : "Organisation removed");
        })
      }
    />
  );
}
