"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateCustomField } from "@/app/(app)/contacts/actions";
import { formatDate } from "@/lib/format";
import type { CustomFieldDefinition } from "@/lib/database.types";
import type { RecordKind } from "./inline-field";

/** Extra fields an Admin or Manager has added in Settings. Saves when you leave the field. */
export function CustomFields({
  kind,
  recordId,
  definitions,
  values,
  canEdit,
}: {
  kind: RecordKind;
  recordId: string;
  definitions: CustomFieldDefinition[];
  values: Record<string, unknown>;
  canEdit: boolean;
}) {
  if (!definitions.length) return null;
  return (
    <dl className="space-y-3">
      {definitions.map((def) => (
        <div key={def.id}>
          <dt className="text-sm font-semibold text-muted-foreground">{def.label}</dt>
          <dd className="mt-1">
            <CustomFieldControl kind={kind} recordId={recordId} def={def} initial={values[def.key]} canEdit={canEdit} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CustomFieldControl({
  kind,
  recordId,
  def,
  initial,
  canEdit,
}: {
  kind: RecordKind;
  recordId: string;
  def: CustomFieldDefinition;
  initial: unknown;
  canEdit: boolean;
}) {
  const [value, setValue] = useState<unknown>(initial ?? (def.field_type === "checkbox" ? false : ""));
  const [saved, setSaved] = useState<unknown>(initial ?? null);
  const [pending, startTransition] = useTransition();

  const save = (next: unknown) => {
    if ((next ?? "") === (saved ?? "")) return;
    startTransition(async () => {
      const result = await updateCustomField(kind, recordId, def.key, next);
      if (!result.ok) {
        toast.error(result.error);
        setValue(saved ?? "");
      } else {
        setSaved(next);
        toast.success(result.message ?? "Saved");
      }
    });
  };

  if (!canEdit) {
    const shown =
      def.field_type === "checkbox" ? (value ? "Yes" : "No") : def.field_type === "date" ? formatDate(String(value || "")) : String(value || "");
    return <span className={shown ? "" : "text-muted-foreground"}>{shown || "Not added"}</span>;
  }

  switch (def.field_type) {
    case "checkbox":
      return (
        <Checkbox
          checked={Boolean(value)}
          disabled={pending}
          aria-label={def.label}
          onCheckedChange={(c) => {
            setValue(c === true);
            save(c === true);
          }}
        />
      );
    case "select":
      return (
        <Select
          value={(value as string) || undefined}
          disabled={pending}
          onValueChange={(v) => {
            setValue(v);
            save(v);
          }}
        >
          <SelectTrigger aria-label={def.label} className="h-9 w-full">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {def.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      return (
        <Input
          aria-label={def.label}
          type={def.field_type === "number" ? "number" : def.field_type === "date" ? "date" : "text"}
          value={String(value ?? "")}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => save(value)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-9"
        />
      );
  }
}
