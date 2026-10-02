import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TimelineItem } from "@/components/records/activity-timeline";

export async function getTimeline(subjectType: "contact" | "organisation", subjectId: string): Promise<TimelineItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("id, type, body, occurred_at, profiles(full_name, preferred_name)")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .order("occurred_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((a) => ({
    id: a.id,
    type: a.type,
    body: a.body,
    occurred_at: a.occurred_at,
    actor_name: a.profiles ? a.profiles.preferred_name || a.profiles.full_name : null,
  }));
}

export async function getCustomFieldDefinitions(entity: "contact" | "organisation") {
  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_field_definitions")
    .select("*")
    .eq("entity", entity)
    .eq("archived", false)
    .order("position");
  return data ?? [];
}

/** Records that someone opened a record, for the audit log (who viewed what). */
export async function logView(entityType: "contacts" | "organisations", entityId: string) {
  const supabase = await createClient();
  await supabase.rpc("write_audit", { p_action: "view", p_entity_type: entityType, p_entity_id: entityId });
}
