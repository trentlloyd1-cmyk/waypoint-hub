import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/page-header";

/** Placeholder for sections that arrive in a later build phase. */
export function ComingSoon({
  title,
  phase,
  summary,
  features,
}: {
  title: string;
  phase: number;
  summary: string;
  features: string[];
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={title} description={summary} />
      <section className="rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950">
            <Hammer className="size-6 text-orange-700 dark:text-orange-300" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-bold">Coming in Phase {phase}</h2>
            <p className="mt-1 text-muted-foreground">Here&apos;s what this section will do once it&apos;s built:</p>
            <ul className="mt-4 space-y-2">
              {features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-teal" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
