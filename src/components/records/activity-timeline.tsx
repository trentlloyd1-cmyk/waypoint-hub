"use client";

import { useState, useTransition } from "react";
import {
  CalendarCheck,
  Handshake,
  Info,
  Loader2,
  Mail,
  MessageSquare,
  MoveRight,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { logActivity } from "@/app/(app)/contacts/actions";
import { formatDateTime, formatFriendly } from "@/lib/format";
import type { ActivityType } from "@/lib/database.types";

export type TimelineItem = {
  id: string;
  type: ActivityType;
  body: string | null;
  occurred_at: string;
  actor_name: string | null;
};

const ICONS: Record<ActivityType, LucideIcon> = {
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  note: StickyNote,
  meeting: Users,
  stage_change: MoveRight,
  referral: Handshake,
  event: CalendarCheck,
  system: Info,
};

const VERBS: Record<ActivityType, string> = {
  call: "Call",
  email: "Email",
  sms: "SMS",
  note: "Note",
  meeting: "Meeting",
  stage_change: "Stage change",
  referral: "Referral",
  event: "Event",
  system: "Update",
};

type LoggableType = "call" | "note" | "meeting";

/** Log a call, note or meeting, and see everything that's happened with this record. */
export function ActivityTimeline({
  subjectType,
  subjectId,
  items,
  canLog,
}: {
  subjectType: "contact" | "organisation";
  subjectId: string;
  items: TimelineItem[];
  canLog: boolean;
}) {
  const [type, setType] = useState<LoggableType>("call");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await logActivity({ subject_type: subjectType, subject_id: subjectId, type, body });
      if (!result.ok) return setError(result.fieldErrors?.body ?? result.error);
      setBody("");
      setError(null);
      toast.success(result.message ?? "Saved");
    });
  };

  return (
    <section aria-labelledby="timeline-heading" className="space-y-4">
      <h2 id="timeline-heading" className="text-lg font-bold">
        Activity
      </h2>

      {canLog && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4">
          <ToggleGroup
            type="single"
            value={type}
            onValueChange={(v) => v && setType(v as LoggableType)}
            variant="outline"
            aria-label="What are you logging?"
          >
            <ToggleGroupItem value="call" className="gap-1.5 px-3">
              <Phone className="size-4" aria-hidden /> Call
            </ToggleGroupItem>
            <ToggleGroupItem value="note" className="gap-1.5 px-3">
              <StickyNote className="size-4" aria-hidden /> Note
            </ToggleGroupItem>
            <ToggleGroupItem value="meeting" className="gap-1.5 px-3">
              <Users className="size-4" aria-hidden /> Meeting
            </ToggleGroupItem>
          </ToggleGroup>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            aria-label={`${VERBS[type]} details`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "timeline-error" : "timeline-hint"}
            placeholder={
              type === "call"
                ? "Who did you speak to, and what's next?"
                : type === "meeting"
                  ? "What did you talk about?"
                  : "Anything the team should know?"
            }
          />
          {error ? (
            <p id="timeline-error" role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : (
            <p id="timeline-hint" className="text-xs text-muted-foreground">
              Keep it to the relationship. Care and clinical notes belong in ShiftCare.
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Log {VERBS[type].toLowerCase()}
            </Button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          Nothing logged yet. Calls, notes and meetings will build up a history here.
        </p>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-border pl-6">
          {items.map((item) => {
            const Icon = ICONS[item.type];
            return (
              <li key={item.id} className="relative">
                <span className="absolute -left-[2.1rem] flex size-8 items-center justify-center rounded-full border-2 border-background bg-secondary">
                  <Icon className="size-4 text-primary" aria-hidden />
                </span>
                <div className="rounded-lg bg-card p-3 ring-1 ring-border">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{VERBS[item.type]}</span>
                    {item.actor_name ? ` by ${item.actor_name}` : ""} ·{" "}
                    <time dateTime={item.occurred_at} title={formatDateTime(item.occurred_at)}>
                      {formatFriendly(item.occurred_at)}
                    </time>
                  </p>
                  {item.body && <p className="mt-1 whitespace-pre-wrap">{item.body}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
