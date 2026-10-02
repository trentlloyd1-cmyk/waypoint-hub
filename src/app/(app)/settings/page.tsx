import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CustomFieldsPanel, ProfilePanel, TagsPanel, TeamPanel } from "./settings-panels";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const user = await requireUser();
  const { profile } = user;
  const role = profile.role;
  const sp = await searchParams;

  const tabs = [
    { key: "profile", label: "Your profile", show: true },
    { key: "team", label: "Team", show: can.manageUsers(role) },
    { key: "tags", label: "Tags", show: can.manageTags(role) },
    { key: "fields", label: "Custom fields", show: can.manageCustomFields(role) },
  ].filter((t) => t.show);
  const requested = typeof sp.tab === "string" ? sp.tab : "profile";
  const tab = tabs.some((t) => t.key === requested) ? requested : "profile";

  const supabase = await createClient();
  let content: React.ReactNode;

  if (tab === "team") {
    const [{ data: people }, { data: invites }] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase
        .from("invitations")
        .select("*")
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false }),
    ]);
    content = <TeamPanel people={people ?? []} invites={invites ?? []} myId={user.id} />;
  } else if (tab === "tags") {
    const { data: tags } = await supabase
      .from("tags")
      .select("id, name, contact_tags(count), organisation_tags(count)")
      .order("name");
    content = (
      <TagsPanel
        tags={(tags ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          uses: (t.contact_tags[0]?.count ?? 0) + (t.organisation_tags[0]?.count ?? 0),
        }))}
      />
    );
  } else if (tab === "fields") {
    const { data: fields } = await supabase.from("custom_field_definitions").select("*").order("entity").order("position");
    content = <CustomFieldsPanel fields={fields ?? []} />;
  } else {
    content = (
      <ProfilePanel
        profile={{
          full_name: profile.full_name,
          preferred_name: profile.preferred_name ?? "",
          phone: profile.phone ?? "",
          email: profile.email,
          role,
          mfa_required: profile.mfa_required,
        }}
        hasMfa={user.hasVerifiedFactor}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" description="Your profile, and how Waypoint Hub is set up for the team." />
      {tabs.length > 1 && (
        <nav aria-label="Settings sections" className="mb-6 flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === "profile" ? "/settings" : `/settings?tab=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center rounded-md px-4 font-semibold",
                tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      {content}
    </div>
  );
}
