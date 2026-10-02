"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Building2, FileUp, Loader2, Moon, Search, UserPlus, UserRound } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { searchEverything, type SearchHit } from "./actions";
import { useRecordDialogs } from "./record-dialogs";
import type { NavItem } from "./nav-items";

const noopSubscribe = () => () => {};

const PaletteContext = createContext<{ open: () => void } | null>(null);

export function useCommandPalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used inside CommandPaletteProvider");
  return ctx;
}

/**
 * The Ctrl+K / Cmd+K bar: find any contact or organisation, jump to a section,
 * or run a quick action. More record types join as their modules are built.
 */
export function CommandPaletteProvider({ children, nav }: { children: React.ReactNode; nav: NavItem[] }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { newContact, newOrganisation, canCreate } = useRecordDialogs();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, startSearch] = useTransition();
  const lastQuery = useRef("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Search as you type, with a short pause so we don't search on every keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      lastQuery.current = q;
      startSearch(async () => {
        const results = await searchEverything(q);
        if (lastQuery.current === q) setHits(results);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const run = useCallback((fn: () => void) => {
    setIsOpen(false);
    setQuery("");
    fn();
  }, []);

  const value = useMemo(() => ({ open: () => setIsOpen(true) }), []);
  const visibleHits = query.trim().length < 2 ? [] : hits;

  return (
    <PaletteContext.Provider value={value}>
      {children}
      <CommandDialog
        open={isOpen}
        onOpenChange={(o) => {
          setIsOpen(o);
          if (!o) setQuery("");
        }}
        title="Search and quick actions"
        description="Type a name, email or phone number, or pick an action"
        className="sm:max-w-xl"
      >
        {/* Server results always match: their value includes the query, so cmdk's filter keeps them. */}
        <Command>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search people, organisations or actions…"
          aria-label="Search"
          className="h-10 text-base"
        />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>
            {searching ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
              </span>
            ) : query.trim().length < 2 ? (
              "Type at least 2 letters to search."
            ) : (
              <>Nothing found for &ldquo;{query}&rdquo;. Check the spelling, or add them as new.</>
            )}
          </CommandEmpty>

          {visibleHits.length > 0 && (
            <CommandGroup heading="Results">
              {visibleHits.map((hit) => (
                <CommandItem
                  key={`${hit.kind}-${hit.id}`}
                  value={`${hit.kind} ${hit.id} ${hit.title} ${query}`}
                  onSelect={() => run(() => router.push(hit.href))}
                >
                  {hit.kind === "contact" ? <UserRound aria-hidden /> : <Building2 aria-hidden />}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{hit.title}</span>
                    {hit.subtitle && <span className="truncate text-xs text-muted-foreground">{hit.subtitle}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {canCreate && (
            <CommandGroup heading="Quick actions">
              <CommandItem value={`new contact person add ${query}`} onSelect={() => run(() => newContact())}>
                <UserPlus aria-hidden /> New contact
              </CommandItem>
              <CommandItem value={`new organisation add ${query}`} onSelect={() => run(() => newOrganisation())}>
                <Building2 aria-hidden /> New organisation
              </CommandItem>
              <CommandItem value={`import contacts csv spreadsheet ${query}`} onSelect={() => run(() => router.push("/contacts/import"))}>
                <FileUp aria-hidden /> Import contacts from a spreadsheet
              </CommandItem>
            </CommandGroup>
          )}

          <CommandSeparator />
          <CommandGroup heading="Go to">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.href}
                  value={`go ${item.label} ${item.description} ${query}`}
                  onSelect={() => run(() => router.push(item.href))}
                >
                  <Icon aria-hidden />
                  {item.label}
                  <span className="ml-1 truncate text-xs text-muted-foreground">{item.description}</span>
                </CommandItem>
              );
            })}
            <CommandItem
              value={`dark light mode theme ${query}`}
              onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
            >
              <Moon aria-hidden /> Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
            </CommandItem>
          </CommandGroup>
        </CommandList>
        </Command>
      </CommandDialog>
    </PaletteContext.Provider>
  );
}

/** The search box in the top bar. Looks like a search field, opens the command bar. */
export function SearchButton() {
  const { open } = useCommandPalette();
  const isMac = useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  return (
    <Button
      variant="outline"
      onClick={open}
      className="h-10 w-full max-w-md justify-start gap-2 rounded-full px-4 text-muted-foreground"
      aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
    >
      <Search className="size-4" aria-hidden />
      <span className="truncate">Search or jump to…</span>
      <CommandShortcut className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 font-sans sm:inline">
        {isMac ? "⌘K" : "Ctrl K"}
      </CommandShortcut>
    </Button>
  );
}
