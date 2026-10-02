"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/form-field";
import { createOrganisation } from "@/app/(app)/contacts/actions";
import { ORGANISATION_TYPE_LABELS } from "@/lib/format";
import { organisationFormSchema, ORGANISATION_TYPES, type OrganisationFormInput as OrganisationInput, type OrganisationFormValues as OrganisationValues } from "@/lib/validation/contacts";

const EMPTY: OrganisationInput = { name: "", type: "support_coordination", phone: "", email: "", website: "", suburb: "" };

export function OrganisationFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The provider remounts this dialog each time it opens, so the form always starts fresh.
  const { register, handleSubmit, formState, setError, control } = useForm<OrganisationInput, unknown, OrganisationValues>({
    resolver: zodResolver(organisationFormSchema),
    defaultValues: EMPTY,
  });
  const errors = formState.errors;

  const onSubmit = (values: OrganisationValues) =>
    startTransition(async () => {
      const result = await createOrganisation(values);
      if (!result.ok) {
        Object.entries(result.fieldErrors ?? {}).forEach(([k, msg]) =>
          setError(k as keyof OrganisationInput, { message: msg }),
        );
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Organisation added.");
      onOpenChange(false);
      router.push(`/organisations/${result.data.id}`);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New organisation</DialogTitle>
          <DialogDescription>A provider, plan manager, community group or anyone we work with.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label="Name" required error={errors.name?.message}>
            {(p) => <Input {...p} {...register("name")} autoComplete="organization" autoFocus />}
          </FormField>
          <FormField label="Type" error={errors.type?.message}>
            {(p) => (
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...p} className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORGANISATION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ORGANISATION_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Phone" error={errors.phone?.message}>
              {(p) => <Input {...p} {...register("phone")} type="tel" inputMode="tel" />}
            </FormField>
            <FormField label="Email" error={errors.email?.message}>
              {(p) => <Input {...p} {...register("email")} type="email" />}
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Website" error={errors.website?.message}>
              {(p) => <Input {...p} {...register("website")} inputMode="url" placeholder="example.org.au" />}
            </FormField>
            <FormField label="Suburb" error={errors.suburb?.message}>
              {(p) => <Input {...p} {...register("suburb")} />}
            </FormField>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Add organisation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
