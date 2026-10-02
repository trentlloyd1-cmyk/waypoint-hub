"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { isActive } from "./sidebar";
import type { NavItem } from "./nav-items";

/** Phone bottom tab bar: the 4 most-used sections plus "More". */
export function MobileNav({ primary, secondary }: { primary: NavItem[]; secondary: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const tabs = primary.filter((i) => i.mobile).slice(0, 4);
  const rest = [...primary.filter((i) => !tabs.includes(i)), ...secondary];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-semibold text-muted-foreground">
              <Menu className="size-5" aria-hidden />
              More
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <SheetHeader>
                <SheetTitle className="sr-only">More sections</SheetTitle>
                <Logo height={28} decorative />
              </SheetHeader>
              <ul className="grid grid-cols-2 gap-2 px-4">
                {rest.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-12 items-center gap-3 rounded-lg border px-3 font-semibold",
                          active && "border-primary bg-secondary text-secondary-foreground",
                        )}
                      >
                        <Icon className="size-5 text-primary" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
