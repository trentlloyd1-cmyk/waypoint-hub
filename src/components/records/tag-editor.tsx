"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Plus, Tag as TagIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ensureTag, setRecordTag } from "@/app/(app)/contacts/actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { RecordKind } from "./inline-field";

type TagLite = { id: string; name: string };

export function TagList({ tags, className }: { tags: TagLite[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Tags">
      {tags.map((t) => (
        <li key={t.id}>
          <Badge variant="secondary" className="rounded-full font-semibold">
            {t.name}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/** Shows a record's tags and lets people add, create or remove them. */
export function TagEditor({
  kind,
  recordId,
  initial,
  canEdit,
}: {
  kind: RecordKind;
  recordId: string;
  initial: TagLite[];
  canEdit: boolean;
}) {
  const [tags, setTags] = useState<TagLite[]>(initial);
  const [all, setAll] = useState<TagLite[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    createClient()
      .from("tags")
      .select("id, name")
      .order("name")
      .then(({ data }) => setAll(data ?? []));
  }, [open]);

  const toggle = (tag: TagLite, on: boolean) =>
    startTransition(async () => {
      setTags((t) => (on ? [...t, tag].sort((a, b) => a.name.localeCompare(b.name)) : t.filter((x) => x.id !== tag.id)));
      const result = await setRecordTag(kind, recordId, tag.id, on);
      if (!result.ok) {
        toast.error(result.error);
        setTags((t) => (on ? t.filter((x) => x.id !== tag.id) : [...t, tag]));
      }
    });

  const create = () =>
    startTransition(async () => {
      const result = await ensureTag(query);
      if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
      setAll((a) => (a.some((t) => t.id === result.data.id) ? a : [...a, result.data]));
      setQuery("");
      if (!tags.some((t) => t.id === result.data.id)) toggle(result.data, true);
    });

  const exact = all.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <Badge key={t.id} variant="secondary" className="gap-1 rounded-full pr-1 font-semibold">
          {t.name}
          {canEdit && (
            <button
              type="button"
              onClick={() => toggle(t, false)}
              className="rounded-full p-0.5 hover:bg-background/60"
              aria-label={`Remove tag ${t.name}`}
            >
              <X className="size-3" aria-hidden />
            </button>
          )}
        </Badge>
      ))}
      {canEdit && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 rounded-full">
              <TagIcon aria-hidden /> {tags.length ? "Tag" : "Add a tag"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Find or create a tag…" value={query} onValueChange={setQuery} />
              <CommandList>
                <CommandEmpty>No tags yet. Type a name to create one.</CommandEmpty>
                <CommandGroup>
                  {all.map((t) => {
                    const on = tags.some((x) => x.id === t.id);
                    return (
                      <CommandItem key={t.id} value={t.name} onSelect={() => toggle(t, !on)}>
                        <Check className={cn("size-4", on ? "opacity-100" : "opacity-0")} aria-hidden />
                        {t.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                {query.trim() && !exact && (
                  <CommandGroup>
                    <CommandItem value={`create ${query}`} onSelect={create}>
                      <Plus className="size-4" aria-hidden /> Create &ldquo;{query.trim()}&rdquo;
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
