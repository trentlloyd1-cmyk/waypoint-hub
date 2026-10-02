"use client";

import { useEffect, useState } from "react";
import { Building2, Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

/** Searchable picker for which organisation a person works for. */
export function OrganisationSelect({
  value,
  onChange,
  id,
  initialLabel,
  ...aria
}: {
  value: string | null | undefined;
  onChange: (id: string | null, name: string | null) => void;
  id?: string;
  initialLabel?: string | null;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** Needed when there's no visible <label htmlFor> pointing at the picker. */
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [label, setLabel] = useState<string | null>(initialLabel ?? null);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    const t = setTimeout(async () => {
      let q = supabase.from("organisations").select("id, name").is("deleted_at", null).order("name").limit(20);
      if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
      const { data } = await q;
      setOptions(data ?? []);
    }, 150);
    return () => clearTimeout(t);
  }, [open, query]);

  const shownLabel = value ? label : null;

  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-10 flex-1 justify-between border-input font-normal"
            {...aria}
          >
            <span className={cn("flex items-center gap-2 truncate", !shownLabel && "text-muted-foreground")}>
              <Building2 className="size-4" aria-hidden />
              {shownLabel ?? "Choose an organisation"}
            </span>
            <ChevronsUpDown className="size-4 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search organisations…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>No organisations match. You can add it from the New button.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={o.id}
                    onSelect={() => {
                      setLabel(o.name);
                      onChange(o.id, o.name);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value === o.id ? "opacity-100" : "opacity-0")} aria-hidden />
                    {o.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          onClick={() => {
            setLabel(null);
            onChange(null, null);
          }}
          aria-label="Clear organisation"
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
