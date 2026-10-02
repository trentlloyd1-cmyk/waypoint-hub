import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  CheckSquare,
  Clock,
  Handshake,
  MessagesSquare,
  Newspaper,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { FontComparison } from "@/components/font-preference";
import { NewContactButton } from "@/components/contacts/new-contact-button";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { displayName, formatFriendly, formatLongDate, greeting } from "@/lib/format";

export const metadata: Metadata = { title: "Today" };

function TodayCard({
  title,
  icon: Icon,
  href,
  linkLabel,
  children,
}: {
  title: string;
  icon: LucideIcon;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="size-5 text-primary" aria-hidden />
          {title}
        </CardTitle>
        {href && linkLabel && (
          <Button asChild variant="link" size="sm" className="px-0">
            <Link href={href}>{linkLabel}</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}

export default async function TodayPage() {
  const { profile } = await requireUser();
  const firstName = (profile.preferred_name || profile.full_name).split(" ")[0];
  const growth = can.viewContacts(profile.role);

  const supabase = await createClient();
  const recentContacts = growth
    ? (
        await supabase
          .from("contacts")
          .select("id, first_name, last_name, preferred_name, created_at, organisations(name)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5)
      ).data ?? []
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="font-semibold text-muted-foreground">{formatLongDate()}</p>
        <h1 className="text-3xl font-extrabold">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TodayCard title="My tasks" icon={CheckSquare}>
          <EmptyState icon={CheckSquare} title="No tasks yet" compact>
            Tasks arrive in the next phase. You&apos;ll see what&apos;s due today right here.
          </EmptyState>
        </TodayCard>

        <TodayCard title="Today's calendar" icon={CalendarDays}>
          <EmptyState icon={CalendarDays} title="Calendar coming soon" compact>
            Once Google Calendar is connected, today&apos;s intake calls and meetings will show here.
          </EmptyState>
        </TodayCard>

        {growth && (
          <TodayCard title="New referrals" icon={Handshake}>
            <EmptyState icon={Handshake} title="Waiting for the referral form" compact>
              New referrals from partners will land here as soon as the public form goes live.
            </EmptyState>
          </TodayCard>
        )}

        <TodayCard title="Leads needing follow-up" icon={Clock}>
          <EmptyState icon={Clock} title="All quiet" compact>
            Leads that haven&apos;t been contacted in a while will be flagged here, so nobody slips through the cracks.
          </EmptyState>
        </TodayCard>

        <TodayCard title="Unread messages" icon={MessagesSquare}>
          <EmptyState icon={MessagesSquare} title="Inbox zero" compact>
            Team chat, email and SMS replies will show up here.
          </EmptyState>
        </TodayCard>

        <TodayCard title="Latest news" icon={Newspaper}>
          <EmptyState icon={Newspaper} title="No news yet" compact>
            Team wins, updates and must-read posts will appear here.
          </EmptyState>
        </TodayCard>
      </div>

      {growth && (
        <TodayCard title="Recently added contacts" icon={UsersRound} href="/contacts" linkLabel="See all contacts">
          {recentContacts.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="Your contact list is empty"
              action={<NewContactButton label="Add your first contact" />}
            >
              Start with the support coordinators and plan managers you talk to most. Or bring them all in at once from a
              spreadsheet.{" "}
              <Link href="/contacts/import" className="font-semibold text-primary underline underline-offset-4">
                Import contacts
              </Link>
            </EmptyState>
          ) : (
            <ul className="divide-y">
              {recentContacts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/contacts/${c.id}`}
                    className="flex items-center justify-between gap-3 rounded-md py-3 hover:bg-muted/60 sm:px-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{displayName(c)}</span>
                      {c.organisations?.name && (
                        <span className="block truncate text-sm text-muted-foreground">{c.organisations.name}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground">{formatFriendly(c.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TodayCard>
      )}

      <FontComparison />
    </div>
  );
}
