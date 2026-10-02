// Database types for Supabase.
// Regenerate after schema changes with: npm run db:types
// (Hand-written for the Phase 1 schema until the first `db:types` run replaces it.)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type AppRole = "admin" | "manager" | "bizdev" | "support";
export type OrganisationType =
  | "support_coordination"
  | "plan_management"
  | "lac"
  | "carer_org"
  | "allied_health"
  | "community_group"
  | "government"
  | "other";
export type ActivityType =
  | "call"
  | "email"
  | "sms"
  | "note"
  | "meeting"
  | "stage_change"
  | "referral"
  | "event"
  | "system";
export type AuditAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "hard_delete"
  | "export"
  | "import"
  | "merge"
  | "login"
  | "invite"
  | "role_change";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  preferred_name: string | null;
  role: AppRole;
  phone: string | null;
  avatar_url: string | null;
  mfa_required: boolean;
  notification_prefs: Json;
  onboarded_at: string | null;
  active: boolean;
  last_seen_at: string | null;
} & Timestamps;

type InvitationRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

type OrganisationRow = {
  id: string;
  name: string;
  type: OrganisationType;
  abn: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address_line: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  notes: string | null;
  custom_fields: Json;
  search_text: string;
  created_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
} & Timestamps;

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address_line: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  organisation_id: string | null;
  job_title: string | null;
  notes: string | null;
  do_not_contact: boolean;
  email_opt_out: boolean;
  sms_opt_out: boolean;
  custom_fields: Json;
  phone_norm: string | null;
  mobile_norm: string | null;
  search_text: string;
  created_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
} & Timestamps;

type TagRow = { id: string; name: string; colour: string; created_by: string | null; created_at: string };

type CustomFieldRow = {
  id: string;
  entity: "contact" | "organisation" | "lead";
  key: string;
  label: string;
  field_type: "text" | "number" | "date" | "select" | "checkbox";
  options: string[];
  position: number;
  archived: boolean;
  created_at: string;
};

type ActivityRow = {
  id: string;
  subject_type: "contact" | "organisation" | "lead" | "referral" | "event";
  subject_id: string;
  type: ActivityType;
  body: string | null;
  metadata: Json;
  actor_id: string | null;
  occurred_at: string;
  created_at: string;
};

type AuditRow = {
  id: number;
  at: string;
  actor_id: string | null;
  actor_email: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  changed_fields: string[];
  details: Json;
};

type AppSettingRow = { key: string; value: Json; updated_at: string; updated_by: string | null };

/** Insert type: generated/defaulted columns become optional. */
type Insertable<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

type Table<Row, Req extends keyof Row, Rel extends unknown[] = []> = {
  Row: Row;
  Insert: Insertable<Row, Req>;
  Update: Partial<Row>;
  Relationships: Rel;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id" | "email">;
      invitations: Table<InvitationRow, "email">;
      organisations: Table<OrganisationRow, "name">;
      contacts: Table<
        ContactRow,
        "first_name",
        [
          {
            foreignKeyName: "contacts_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ]
      >;
      tags: Table<TagRow, "name">;
      contact_tags: Table<
        { contact_id: string; tag_id: string },
        "contact_id" | "tag_id",
        [
          {
            foreignKeyName: "contact_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_tags_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ]
      >;
      organisation_tags: Table<
        { organisation_id: string; tag_id: string },
        "organisation_id" | "tag_id",
        [
          {
            foreignKeyName: "organisation_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organisation_tags_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ]
      >;
      custom_field_definitions: Table<CustomFieldRow, "entity" | "key" | "label" | "field_type">;
      activities: Table<
        ActivityRow,
        "subject_type" | "subject_id" | "type",
        [
          {
            foreignKeyName: "activities_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      audit_log: Table<AuditRow, "action" | "entity_type">;
      app_settings: Table<AppSettingRow, "key" | "value">;
    };
    Views: Record<never, never>;
    Functions: {
      global_search: {
        Args: { q: string; max_results?: number };
        Returns: { kind: "contact" | "organisation"; id: string; title: string; subtitle: string; score: number }[];
      };
      find_contact_duplicates: {
        Args: {
          p_first_name: string;
          p_last_name: string;
          p_email?: string | null;
          p_phone?: string | null;
          p_exclude?: string | null;
        };
        Returns: {
          id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          mobile: string | null;
          reason: string;
        }[];
      };
      merge_contacts: { Args: { p_keep: string; p_merge: string }; Returns: undefined };
      write_audit: {
        Args: {
          p_action: AuditAction;
          p_entity_type: string;
          p_entity_id?: string | null;
          p_changed_fields?: string[];
          p_details?: Json;
        };
        Returns: undefined;
      };
      current_app_role: { Args: Record<never, never>; Returns: AppRole };
    };
    Enums: {
      app_role: AppRole;
      organisation_type: OrganisationType;
      activity_type: ActivityType;
      audit_action: AuditAction;
    };
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Profile = Tables<"profiles">;
export type Contact = Tables<"contacts">;
export type Organisation = Tables<"organisations">;
export type Tag = Tables<"tags">;
export type Activity = Tables<"activities">;
export type CustomFieldDefinition = Tables<"custom_field_definitions">;
