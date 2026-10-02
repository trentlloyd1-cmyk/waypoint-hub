"use client";

import { Building2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordDialogs } from "@/components/shell/record-dialogs";

export function NewContactButton({ label = "New contact", organisationId }: { label?: string; organisationId?: string }) {
  const { newContact, canCreate } = useRecordDialogs();
  if (!canCreate) return null;
  return (
    <Button onClick={() => newContact(organisationId ? { organisation_id: organisationId } : {})}>
      <UserPlus aria-hidden /> {label}
    </Button>
  );
}

export function NewOrganisationButton({ label = "New organisation", variant = "outline" }: { label?: string; variant?: "outline" | "default" }) {
  const { newOrganisation, canCreate } = useRecordDialogs();
  if (!canCreate) return null;
  return (
    <Button variant={variant} onClick={() => newOrganisation()}>
      <Building2 aria-hidden /> {label}
    </Button>
  );
}
