import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { can, ROLE_LABELS } from "@/lib/permissions";

/** Everything signed-in staff see lives inside this layout. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const { profile } = user;

  return (
    <AppShell
      user={{
        name: profile.preferred_name || profile.full_name,
        email: profile.email,
        roleLabel: ROLE_LABELS[profile.role],
        avatarUrl: profile.avatar_url,
      }}
      role={profile.role}
      canCreateRecords={can.editContacts(profile.role)}
      showOnboarding={!profile.onboarded_at}
    >
      {children}
    </AppShell>
  );
}
