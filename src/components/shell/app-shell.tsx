"use client";

import Link from "next/link";
import { PinMark } from "@/components/brand/logo";
import { FontPreferenceLoader } from "@/components/font-preference";
import { CommandPaletteProvider, SearchButton } from "./command-palette";
import { IdleTimeout } from "./idle-timeout";
import { MobileNav } from "./mobile-nav";
import { NewMenu } from "./new-menu";
import { OnboardingTour } from "./onboarding-tour";
import { RecordDialogsProvider } from "./record-dialogs";
import { Sidebar } from "./sidebar";
import { UserMenu, type ShellUser } from "./user-menu";
import { PRIMARY_NAV, SECONDARY_NAV, visibleNav } from "./nav-items";
import type { AppRole } from "@/lib/database.types";

export function AppShell({
  children,
  user,
  role,
  canCreateRecords,
  showOnboarding,
}: {
  children: React.ReactNode;
  user: ShellUser;
  role: AppRole;
  canCreateRecords: boolean;
  showOnboarding: boolean;
}) {
  const primary = visibleNav(PRIMARY_NAV, role);
  const secondary = visibleNav(SECONDARY_NAV, role);

  return (
    <RecordDialogsProvider canCreate={canCreateRecords}>
      <CommandPaletteProvider nav={[...primary, ...secondary]}>
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to main content
        </a>
        <div className="flex min-h-dvh">
          <Sidebar primary={primary} secondary={secondary} />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
              <Link href="/today" className="rounded-md lg:hidden" aria-label="Waypoint Hub, go to Today">
                <PinMark size={32} />
              </Link>
              <div className="min-w-0 flex-1">
                <SearchButton />
              </div>
              <NewMenu />
              <UserMenu user={user} />
            </header>
            <main id="main" tabIndex={-1} className="flex-1 px-4 pt-6 pb-24 outline-none sm:px-6 lg:px-8 lg:pb-10">
              {children}
            </main>
          </div>
        </div>
        <MobileNav primary={primary} secondary={secondary} />
        <IdleTimeout />
        <FontPreferenceLoader />
        {showOnboarding && <OnboardingTour firstName={user.name.split(" ")[0] ?? ""} />}
      </CommandPaletteProvider>
    </RecordDialogsProvider>
  );
}
