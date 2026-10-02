"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";

export function isActive(pathname: string, href: string) {
  if (href === "/contacts") return pathname.startsWith("/contacts") || pathname.startsWith("/organisations");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-[0.95rem] font-semibold transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/85 hover:bg-muted hover:text-sidebar-foreground",
      )}
    >
      <Icon className={cn("size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}

/** Desktop and tablet sidebar. Hidden on phones, where the bottom tab bar takes over. */
export function Sidebar({ primary, secondary }: { primary: NavItem[]; secondary: NavItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/today" aria-label="Waypoint Hub, go to Today" className="rounded-md">
          <Logo height={36} decorative />
        </Link>
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {primary.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="mt-auto border-t pt-3">
          {secondary.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>
    </aside>
  );
}
