"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SearchHit = { kind: "contact" | "organisation"; id: string; title: string; subtitle: string; href: string };

/** Ctrl+K search. Runs as the signed-in person, so they only find what they're allowed to see. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  await actionUser();
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("global_search", { q, max_results: 6 });
  return (data ?? []).map((r) => ({
    kind: r.kind,
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    href: r.kind === "contact" ? `/contacts/${r.id}` : `/organisations/${r.id}`,
  }));
}

/** Marks the first-login walkthrough as done so it doesn't show again. */
export async function completeOnboarding() {
  const user = await actionUser();
  const supabase = await createClient();
  await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", user.id);
  revalidatePath("/", "layout");
}
