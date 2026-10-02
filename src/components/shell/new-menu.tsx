"use client";

import { Building2, CalendarPlus, Handshake, ListTodo, Plus, UserPlus, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRecordDialogs } from "./record-dialogs";

/** The orange "+ New" button, on every screen. */
export function NewMenu() {
  const { newContact, newOrganisation, canCreate } = useRecordDialogs();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-10 rounded-full bg-cta px-4 text-base font-bold text-cta-foreground hover:bg-orange-400">
          <Plus className="size-5" aria-hidden />
          New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {canCreate ? (
          <>
            <DropdownMenuItem onSelect={() => newContact()}>
              <UserPlus aria-hidden /> Contact
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => newOrganisation()}>
              <Building2 aria-hidden /> Organisation
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            Nothing to add yet. Tasks and messages arrive soon.
          </DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Coming in the next phases</DropdownMenuLabel>
        <DropdownMenuItem disabled>
          <Handshake aria-hidden /> Referral
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Workflow aria-hidden /> Lead
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <ListTodo aria-hidden /> Task
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <CalendarPlus aria-hidden /> Calendar event
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
