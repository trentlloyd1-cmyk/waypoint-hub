"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { OrganisationSelect } from "./organisation-select";
import { createContact, type DuplicateMatch } from "@/app/(app)/contacts/actions";
import { contactFormSchema, type ContactFormInput as ContactInput, type ContactFormValues as ContactValues } from "@/lib/validation/contacts";

const EMPTY: ContactInput = {
  first_name: "",
  last_name: "",
  preferred_name: "",
  email: "",
  mobile: "",
  phone: "",
  suburb: "",
  job_title: "",
  notes: "",
  organisation_id: null,
};

/** Quick "add a person" form. Warns about likely duplicates before saving. */
export function ContactFormDialog({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: { organisation_id?: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);

  const form = useForm<ContactInput, unknown, ContactValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { ...EMPTY, ...defaults },
  });
  // The provider remounts this dialog each time it opens, so the form always starts fresh.
  const { register, handleSubmit, formState, setError, control } = form;
  const errors = formState.errors;

  const save = (values: ContactValues, allowDuplicate: boolean) =>
    startTransition(async () => {
      const result = await createContact(values, { allowDuplicate });
      if (!result.ok) {
        Object.entries(result.fieldErrors ?? {}).forEach(([k, msg]) =>
          setError(k as keyof ContactInput, { message: msg }),
        );
        toast.error(result.error);
        return;
      }
      if (result.data.duplicates?.length) {
        setDuplicates(result.data.duplicates);
        return;
      }
      toast.success(result.message ?? "Contact added.");
      onOpenChange(false);
      router.push(`/contacts/${result.data.id}`);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New contact</DialogTitle>
          <DialogDescription>Just a first name is enough to start. You can add more later.</DialogDescription>
        </DialogHeader>

        {duplicates ? (
          <div className="space-y-4" role="alert">
            <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">This person might already be in Waypoint Hub</p>
                <p className="text-sm">Have a look before adding them again. Duplicates make history hard to follow.</p>
              </div>
            </div>
            <ul className="divide-y rounded-lg border">
              {duplicates.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 p-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {d.first_name} {d.last_name}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {d.reason}
                      {d.email ? ` · ${d.email}` : ""}
                      {d.mobile ? ` · ${d.mobile}` : ""}
                    </span>
                  </span>
                  <Button asChild variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    <Link href={`/contacts/${d.id}`}>Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setDuplicates(null)}>
                Back to the form
              </Button>
              <Button disabled={pending} onClick={handleSubmit((v) => save(v, true))}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                They&apos;re different, add anyway
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit((v) => save(v, false))} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="First name" required error={errors.first_name?.message}>
                {(p) => <Input {...p} {...register("first_name")} autoComplete="off" autoFocus />}
              </FormField>
              <FormField label="Last name" error={errors.last_name?.message}>
                {(p) => <Input {...p} {...register("last_name")} autoComplete="off" />}
              </FormField>
            </div>
            <FormField label="Preferred name" hint="What they like to be called, if different." error={errors.preferred_name?.message}>
              {(p) => <Input {...p} {...register("preferred_name")} autoComplete="off" />}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Mobile" error={errors.mobile?.message}>
                {(p) => <Input {...p} {...register("mobile")} type="tel" inputMode="tel" autoComplete="off" placeholder="0412 345 678" />}
              </FormField>
              <FormField label="Email" error={errors.email?.message}>
                {(p) => <Input {...p} {...register("email")} type="email" autoComplete="off" />}
              </FormField>
            </div>
            <FormField label="Organisation" hint="Where they work, e.g. their support coordination provider." error={errors.organisation_id?.message}>
              {(p) => (
                <Controller
                  control={control}
                  name="organisation_id"
                  render={({ field }) => <OrganisationSelect {...p} value={field.value} onChange={(id) => field.onChange(id)} />}
                />
              )}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Job title" error={errors.job_title?.message}>
                {(p) => <Input {...p} {...register("job_title")} autoComplete="off" />}
              </FormField>
              <FormField label="Suburb" error={errors.suburb?.message}>
                {(p) => <Input {...p} {...register("suburb")} autoComplete="off" />}
              </FormField>
            </div>
            <FormField label="Notes" hint="Relationship notes only. Care information belongs in ShiftCare." error={errors.notes?.message}>
              {(p) => <Textarea {...p} {...register("notes")} rows={3} />}
            </FormField>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Add contact
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
