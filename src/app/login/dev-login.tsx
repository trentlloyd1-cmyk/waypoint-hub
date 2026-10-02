import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/permissions";
import { TEST_USERS } from "@/lib/test-users";
import { devSignIn } from "./dev-actions";

/** Development-only panel for signing in as a seeded test user. Never rendered in production. */
export function DevLogin({ next }: { next: string }) {
  return (
    <section
      aria-labelledby="dev-login-heading"
      className="mt-6 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-5 dark:bg-amber-950/40"
    >
      <h2 id="dev-login-heading" className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-100">
        <FlaskConical className="size-5" aria-hidden />
        Test mode: sign in as a fake user
      </h2>
      <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
        Only shows on your computer while testing. Try each role to see what they can and can&apos;t do.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {TEST_USERS.map((u) => (
          <form key={u.email} action={devSignIn}>
            <input type="hidden" name="email" value={u.email} />
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="outline" className="h-auto w-full flex-col items-start py-2 text-left">
              <span className="font-semibold">{ROLE_LABELS[u.role]}</span>
              <span className="text-xs font-normal text-muted-foreground">{u.name}</span>
            </Button>
          </form>
        ))}
      </div>
    </section>
  );
}
