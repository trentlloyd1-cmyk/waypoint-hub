"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, MailPlus, Pencil, ShieldCheck, ShieldOff, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/form-field";
import type { AppRole, CustomFieldDefinition, Profile } from "@/lib/database.types";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { formatDate, formatFriendly } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import {
  addCustomField,
  archiveCustomField,
  changeRole,
  deleteTag,
  inviteUser,
  removeMyMfa,
  renameTag,
  resetUserMfa,
  revokeInvitation,
  setMfaRequired,
  setUserActive,
  updateMyProfile,
} from "./actions";

const ROLES: AppRole[] = ["admin", "manager", "bizdev", "support"];

/** Runs an action and shows its friendly message as a toast. */
function useAction() {
  const [pending, startTransition] = useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, onOk?: (r: T) => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        if (result.message) toast.success(result.message);
        onOk?.(result.data);
      } else toast.error(result.error);
    });
  return { pending, run };
}

// ---------------------------------------------------------------------------

export function ProfilePanel({
  profile,
  hasMfa,
}: {
  profile: { full_name: string; preferred_name: string; phone: string; email: string; role: AppRole; mfa_required: boolean };
  hasMfa: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState({ full_name: profile.full_name, preferred_name: profile.preferred_name, phone: profile.phone });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { pending, run } = useAction();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
          <CardDescription>
            Signed in as {profile.email} · {ROLE_LABELS[profile.role]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              startSave();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name" required error={errors.full_name}>
                {(p) => <Input {...p} value={values.full_name} onChange={(e) => setValues({ ...values, full_name: e.target.value })} autoComplete="name" />}
              </FormField>
              <FormField label="Preferred name" hint="What the team calls you." error={errors.preferred_name}>
                {(p) => <Input {...p} value={values.preferred_name} onChange={(e) => setValues({ ...values, preferred_name: e.target.value })} autoComplete="nickname" />}
              </FormField>
            </div>
            <FormField label="Mobile" hint="So the team can reach you." error={errors.phone}>
              {(p) => <Input {...p} type="tel" value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} autoComplete="tel" className="sm:max-w-xs" />}
            </FormField>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" aria-hidden /> Two-step sign-in
          </CardTitle>
          <CardDescription>
            {hasMfa
              ? "On. You'll enter a code from your authenticator app each time you sign in."
              : "Off. Add a code from your phone when you sign in, for extra protection."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasMfa ? (
            profile.mfa_required ? (
              <p className="text-sm text-muted-foreground">Your role requires it, so it stays on.</p>
            ) : (
              <Button variant="outline" disabled={pending} onClick={() => run(() => removeMyMfa(), () => router.refresh())}>
                <ShieldOff aria-hidden /> Turn off
              </Button>
            )
          ) : (
            <Button asChild>
              <Link href="/settings/two-step">Set it up</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  function startSave() {
    setErrors({});
    run(
      async () => {
        const r = await updateMyProfile(values);
        if (!r.ok && r.fieldErrors) setErrors(r.fieldErrors);
        return r;
      },
      () => router.refresh(),
    );
  }
}

// ---------------------------------------------------------------------------

type Invite = { id: string; email: string; full_name: string | null; role: AppRole; created_at: string; expires_at: string };

export function TeamPanel({ people, invites, myId }: { people: Profile[]; invites: Invite[]; myId: string }) {
  const [form, setForm] = useState({ full_name: "", email: "", role: "support" as AppRole });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { pending, run } = useAction();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailPlus className="size-5 text-primary" aria-hidden /> Invite someone
          </CardTitle>
          <CardDescription>Waypoint Hub is invite-only. They&apos;ll get an email with a link to sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setErrors({});
              run(
                async () => {
                  const r = await inviteUser(form);
                  if (!r.ok && r.fieldErrors) setErrors(r.fieldErrors);
                  return r;
                },
                () => setForm({ full_name: "", email: "", role: "support" }),
              );
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name" required error={errors.full_name}>
                {(p) => <Input {...p} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoComplete="off" />}
              </FormField>
              <FormField label="Email" required error={errors.email}>
                {(p) => <Input {...p} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />}
              </FormField>
            </div>
            <FormField label="Role" hint={ROLE_DESCRIPTIONS[form.role]}>
              {(p) => (
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger {...p} className="h-10 w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Send invitation
            </Button>
          </form>
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Waiting to accept</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span>
                    <span className="block font-semibold">{i.full_name || i.email}</span>
                    <span className="block text-sm text-muted-foreground">
                      {i.email} · {ROLE_LABELS[i.role]} · invited {formatFriendly(i.created_at)} · expires {formatDate(i.expires_at)}
                    </span>
                  </span>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => revokeInvitation(i.id))}>
                    Cancel invitation
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>The team ({people.filter((p) => p.active).length})</CardTitle>
          <CardDescription>Change roles, require two-step sign-in, or remove access when someone leaves.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {people.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {p.preferred_name || p.full_name || p.email}
                    {p.id === myId && <Badge variant="secondary">You</Badge>}
                    {!p.active && <Badge variant="outline">No access</Badge>}
                    {p.mfa_required && <Badge variant="outline">2-step required</Badge>}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {p.email} · {ROLE_LABELS[p.role]}
                  </span>
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={pending}>
                      Manage
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Role</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={p.role} onValueChange={(r) => run(() => changeRole(p.id, r as AppRole))}>
                      {ROLES.map((r) => (
                        <DropdownMenuRadioItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => run(() => setMfaRequired(p.id, !p.mfa_required))}>
                      <ShieldCheck aria-hidden /> {p.mfa_required ? "Make two-step optional" : "Require two-step sign-in"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => run(() => resetUserMfa(p.id))}>
                      <ShieldOff aria-hidden /> Reset two-step (lost phone)
                    </DropdownMenuItem>
                    {p.id !== myId && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant={p.active ? "destructive" : "default"}
                          onSelect={() => run(() => setUserActive(p.id, !p.active))}
                        >
                          {p.active ? "Remove access" : "Restore access"}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function TagsPanel({ tags }: { tags: { id: string; name: string; uses: number }[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const { pending, run } = useAction();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags</CardTitle>
        <CardDescription>
          Anyone in Business Development can create tags while tagging a contact. Here you can tidy them up.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <p className="text-muted-foreground">No tags yet. Add one from any contact or organisation page.</p>
        ) : (
          <ul className="divide-y">
            {tags.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                {editing === t.id ? (
                  <form
                    className="flex flex-1 gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(() => renameTag(t.id, draft), () => setEditing(null));
                    }}
                  >
                    <Input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`New name for ${t.name}`} autoFocus className="h-9 max-w-xs" />
                    <Button type="submit" size="icon" disabled={pending} aria-label="Save tag name">
                      <Check aria-hidden />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel">
                      <X aria-hidden />
                    </Button>
                  </form>
                ) : (
                  <span>
                    <span className="font-semibold">{t.name}</span>{" "}
                    <span className="text-sm text-muted-foreground">
                      · used {t.uses} {t.uses === 1 ? "time" : "times"}
                    </span>
                  </span>
                )}
                {editing !== t.id && (
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Rename ${t.name}`}
                      onClick={() => {
                        setEditing(t.id);
                        setDraft(t.name);
                      }}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${t.name}`}
                      disabled={pending}
                      onClick={() => {
                        if (confirm(`Delete the "${t.name}" tag? It'll be removed from ${t.uses} records.`)) run(() => deleteTag(t.id));
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

const FIELD_TYPE_LABELS = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  checkbox: "Yes / no tick box",
} as const;

export function CustomFieldsPanel({ fields }: { fields: CustomFieldDefinition[] }) {
  const [form, setForm] = useState({
    entity: "contact" as "contact" | "organisation",
    label: "",
    field_type: "text" as keyof typeof FIELD_TYPE_LABELS,
    options: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { pending, run } = useAction();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a custom field</CardTitle>
          <CardDescription>
            Extra details you want to keep for every contact or organisation. Keep clinical or care information out. That
            belongs in ShiftCare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setErrors({});
              run(
                async () => {
                  const r = await addCustomField({
                    ...form,
                    options: form.options.split(",").map((o) => o.trim()).filter(Boolean),
                  });
                  if (!r.ok && r.fieldErrors) setErrors(r.fieldErrors);
                  return r;
                },
                () => setForm({ ...form, label: "", options: "" }),
              );
            }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="For">
                {(p) => (
                  <Select value={form.entity} onValueChange={(v) => setForm({ ...form, entity: v as "contact" | "organisation" })}>
                    <SelectTrigger {...p} className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contact">People</SelectItem>
                      <SelectItem value="organisation">Organisations</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField label="Field name" required error={errors.label}>
                {(p) => <Input {...p} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Preferred contact time" />}
              </FormField>
              <FormField label="Type">
                {(p) => (
                  <Select value={form.field_type} onValueChange={(v) => setForm({ ...form, field_type: v as keyof typeof FIELD_TYPE_LABELS })}>
                    <SelectTrigger {...p} className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FIELD_TYPE_LABELS).map(([k, l]) => (
                        <SelectItem key={k} value={k}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </div>
            {form.field_type === "select" && (
              <FormField label="Options" hint="Separate with commas, e.g. Morning, Afternoon, Evening" error={errors.options}>
                {(p) => <Input {...p} value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} />}
              </FormField>
            )}
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Add field
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your custom fields</CardTitle>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <p className="text-muted-foreground">None yet.</p>
          ) : (
            <ul className="divide-y">
              {fields.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-semibold">{f.label}</span>{" "}
                    <span className="text-sm text-muted-foreground">
                      · {f.entity === "contact" ? "People" : "Organisations"} · {FIELD_TYPE_LABELS[f.field_type]}
                      {f.options.length ? ` (${f.options.join(", ")})` : ""}
                    </span>
                    {f.archived && (
                      <Badge variant="outline" className="ml-2">
                        Hidden
                      </Badge>
                    )}
                  </span>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => archiveCustomField(f.id, !f.archived))}>
                    {f.archived ? "Show" : "Hide"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
