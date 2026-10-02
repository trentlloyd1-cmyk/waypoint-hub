import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Friendly "nothing here yet" panel that explains what to do next. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      <div className={cn("flex items-center justify-center rounded-full bg-secondary", compact ? "size-10" : "size-14")}>
        <Icon className={cn("text-primary", compact ? "size-5" : "size-7")} aria-hidden />
      </div>
      <p className={cn("font-bold", compact ? "text-base" : "text-lg")}>{title}</p>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
