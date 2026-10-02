"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Combine, Loader2, MoreHorizontal, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  deleteContact,
  deleteOrganisation,
  mergeContacts,
  restoreContact,
  restoreOrganisation,
} from "@/app/(app)/contacts/actions";
import { createClient } from "@/lib/supabase/client";
import type { RecordKind } from "./inline-field";

type ContactLite = { id: string; first_name: string; last_name: string; email: string | null; mobile: string | null };

export function RecordActions({
  kind,
  recordId,
  name,
  deleted,
  canDelete,
  canMerge,
  self,
}: {
  kind: RecordKind;
  recordId: string;
  name: string;
  deleted: boolean;
  canDelete: boolean;
  canMerge: boolean;
  self?: ContactLite;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canDelete && !canMerge) return null;

  const restore = () =>
    startTransition(async () => {
      const result = kind === "contact" ? await restoreContact(recordId) : await restoreOrganisation(recordId);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });

  if (deleted) {
    return canDelete ? (
      <Button onClick={restore} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />} Restore
      </Button>
    ) : null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-lg" aria-label={`More actions for ${name}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canMerge && kind === "contact" && (
            <DropdownMenuItem onSelect={() => setMergeOpen(true)}>
              <Combine aria-hidden /> Merge with a duplicate
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden /> Move to bin
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {name} to the bin?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll disappear from lists and search. An Admin or Manager can restore them from the bin for 30 days,
              after which they&apos;re deleted for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() =>
                startTransition(async () => {
                  const result = kind === "contact" ? await deleteContact(recordId) : await deleteOrganisation(recordId);
                  if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                  toast.success(result.message);
                  router.push("/contacts" + (kind === "organisation" ? "?tab=organisations" : ""));
                })
              }
            >
              Move to bin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {kind === "contact" && self && <MergeDialog open={mergeOpen} onOpenChange={setMergeOpen} self={self} />}
    </>
  );
}

function MergeDialog({
  open,
  onOpenChange,
  self,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  self: ContactLite;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(`${self.first_name} ${self.last_name}`.trim());
  const [results, setResults] = useState<ContactLite[]>([]);
  const [other, setOther] = useState<ContactLite | null>(null);
  const [keep, setKeep] = useState<"self" | "other">("self");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const q = query.trim().toLowerCase();
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      const { data } = await createClient()
        .from("contacts")
        .select("id, first_name, last_name, email, mobile")
        .is("deleted_at", null)
        .neq("id", self.id)
        .ilike("search_text", `%${q}%`)
        .limit(8);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [open, query, self.id]);

  const shownResults = query.trim().length < 2 ? [] : results;
  const describe = (c: ContactLite) => [c.email, c.mobile].filter(Boolean).join(" · ") || "No email or mobile";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge duplicate contacts</DialogTitle>
          <DialogDescription>
            Pick the duplicate, then choose which record to keep. Gaps are filled from the other one, tags and history
            are combined, and opt-outs are always kept.
          </DialogDescription>
        </DialogHeader>

        {!other ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                aria-label="Search for the duplicate"
                autoFocus
              />
            </div>
            <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
              {shownResults.length === 0 && <li className="p-4 text-sm text-muted-foreground">No other matching contacts.</li>}
              {shownResults.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setOther(c)} className="w-full p-3 text-left hover:bg-muted">
                    <span className="block font-semibold">
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="block text-sm text-muted-foreground">{describe(c)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <RadioGroup value={keep} onValueChange={(v) => setKeep(v as "self" | "other")} aria-label="Which record to keep">
              {(
                [
                  ["self", self],
                  ["other", other],
                ] as const
              ).map(([key, c]) => (
                <Label
                  key={key}
                  htmlFor={`keep-${key}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary"
                >
                  <RadioGroupItem id={`keep-${key}`} value={key} className="mt-1" />
                  <span>
                    <span className="block font-bold">
                      Keep {c.first_name} {c.last_name}
                      {key === "self" ? " (this record)" : ""}
                    </span>
                    <span className="block text-sm font-normal text-muted-foreground">{describe(c)}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setOther(null)}>
                Pick a different one
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const keepId = keep === "self" ? self.id : other.id;
                    const mergeId = keep === "self" ? other.id : self.id;
                    const result = await mergeContacts(keepId, mergeId);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success(result.message);
                    onOpenChange(false);
                    router.push(`/contacts/${keepId}`);
                  })
                }
              >
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Merge
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
