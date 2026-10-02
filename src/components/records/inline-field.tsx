"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateContactField, updateOrganisationField } from "@/app/(app)/contacts/actions";
import { cn } from "@/lib/utils";

export type RecordKind = "contact" | "organisation";

function saveField(kind: RecordKind, id: string, field: string, value: unknown) {
  return kind === "contact" ? updateContactField(id, field, value) : updateOrganisationField(id, field, value);
}

type Common = {
  kind: RecordKind;
  recordId: string;
  field: string;
  label: string;
  canEdit: boolean;
};

/**
 * Click-to-edit field. Enter saves, Escape cancels. Keyboard and screen reader friendly:
 * the read view is a button that says what it edits.
 */
export function InlineText({
  value,
  display,
  multiline = false,
  type = "text",
  placeholder = "Add",
  ...common
}: Common & {
  value: string | null;
  display?: React.ReactNode;
  multiline?: boolean;
  type?: "text" | "email" | "tel" | "url";
  placeholder?: string;
}) {
  const { kind, recordId, field, label, canEdit } = common;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);

  // Pick up fresh values from the server (e.g. after someone else edits) without an effect.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setCurrent(value);
  }
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const cancel = () => {
    setEditing(false);
    setDraft(current ?? "");
    setError(null);
    requestAnimationFrame(() => editButton.current?.focus());
  };

  const save = () =>
    startTransition(async () => {
      if ((draft.trim() || null) === (current || null)) return cancel();
      const result = await saveField(kind, recordId, field, draft);
      if (!result.ok) return setError(result.error);
      setCurrent((result.data.value as string | null) ?? null);
      setEditing(false);
      setError(null);
      toast.success(`${label} saved`);
      requestAnimationFrame(() => editButton.current?.focus());
    });

  if (!editing) {
    const shown = display ?? current;
    if (!canEdit) {
      return <span className={cn(!shown && "text-muted-foreground")}>{shown || "Not added"}</span>;
    }
    return (
      <button
        ref={editButton}
        type="button"
        onClick={() => {
          setDraft(current ?? "");
          setEditing(true);
        }}
        className="group -mx-2 flex w-[calc(100%+1rem)] items-start justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-muted"
        aria-label={`Edit ${label}${current ? `: ${current}` : ""}`}
      >
        <span className={cn("min-w-0 break-words whitespace-pre-wrap", !shown && "text-muted-foreground")}>
          {shown || placeholder}
        </span>
        <Pencil className="mt-1 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" aria-hidden />
      </button>
    );
  }

  const inputProps = {
    ref: inputRef,
    value: draft,
    "aria-label": label,
    "aria-invalid": Boolean(error),
    disabled: pending,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(e.target.value),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") cancel();
      if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        save();
      }
    },
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-1">
        {multiline ? <Textarea {...inputProps} rows={4} /> : <Input {...inputProps} type={type} className="h-9" />}
        <Button size="icon" onClick={save} disabled={pending} aria-label={`Save ${label}`}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        </Button>
        <Button size="icon" variant="ghost" onClick={cancel} disabled={pending} aria-label="Cancel">
          <X aria-hidden />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {multiline && <p className="text-xs text-muted-foreground">Ctrl + Enter to save, Esc to cancel</p>}
    </div>
  );
}

export function InlineSelect({
  value,
  options,
  ...common
}: Common & { value: string | null; options: { value: string; label: string }[] }) {
  const { kind, recordId, field, label, canEdit } = common;
  const [current, setCurrent] = useState(value);
  const [pending, startTransition] = useTransition();
  const shown = options.find((o) => o.value === current)?.label;

  if (!canEdit) return <span className={cn(!shown && "text-muted-foreground")}>{shown ?? "Not added"}</span>;

  return (
    <Select
      value={current ?? undefined}
      disabled={pending}
      onValueChange={(v) =>
        startTransition(async () => {
          const previous = current;
          setCurrent(v);
          const result = await saveField(kind, recordId, field, v);
          if (!result.ok) {
            setCurrent(previous);
            toast.error(result.error);
          } else toast.success(`${label} saved`);
        })
      }
    >
      <SelectTrigger aria-label={label} className="h-9 w-full">
        <SelectValue placeholder="Choose…" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function InlineSwitch({
  value,
  description,
  onLabel,
  ...common
}: Common & { value: boolean; description?: string; onLabel?: string }) {
  const { kind, recordId, field, label, canEdit } = common;
  const [current, setCurrent] = useState(value);
  const [pending, startTransition] = useTransition();
  const id = `${field}-${recordId}`;
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0">
        <span className="block font-semibold">{label}</span>
        {description && <span className="block text-sm text-muted-foreground">{description}</span>}
      </label>
      <Switch
        id={id}
        checked={current}
        disabled={!canEdit || pending}
        onCheckedChange={(v) =>
          startTransition(async () => {
            setCurrent(v);
            const result = await saveField(kind, recordId, field, v);
            if (!result.ok) {
              setCurrent(!v);
              toast.error(result.error);
            } else toast.success(v ? (onLabel ?? `${label}: on`) : `${label}: off`);
          })
        }
      />
    </div>
  );
}
