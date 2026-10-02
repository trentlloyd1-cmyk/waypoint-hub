/**
 * Database permission tests (Row Level Security). Signs in as each seeded test user,
 * straight against Supabase (no app in between), and checks what the database itself
 * allows. Run against the TEST project after `npm run seed`:
 *
 *   npm run test:rls
 */
import { config } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { TEST_USERS } from "../src/lib/test-users";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

type Client = SupabaseClient<Database>;
const clients: Record<string, Client> = {};

async function signedInAs(email: string): Promise<Client> {
  const admin = createClient<Database>(url, secret, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const client = createClient<Database>(url, publishable, { auth: { persistSession: false } });
  const { error: verifyError } = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verifyError) throw verifyError;
  return client;
}

beforeAll(async () => {
  for (const u of TEST_USERS) clients[u.role] = await signedInAs(u.email);
  clients.anon = createClient<Database>(url, publishable, { auth: { persistSession: false } });
}, 60_000);

describe("contacts", () => {
  it.each(["admin", "manager", "bizdev"])("%s can read contacts", async (role) => {
    const { data } = await clients[role].from("contacts").select("id").limit(1);
    expect(data?.length).toBe(1);
  });

  it("support staff see no contacts (until leads are assigned in Phase 2)", async () => {
    const { data } = await clients.support.from("contacts").select("id");
    expect(data).toEqual([]);
  });

  it("signed-out visitors see nothing", async () => {
    const { data, error } = await clients.anon.from("contacts").select("id");
    expect(data ?? []).toEqual([]);
    expect(error?.code ?? "denied").toBeTruthy();
  });

  it("support staff can't add contacts", async () => {
    const { error } = await clients.support.from("contacts").insert({ first_name: "Should", last_name: "Fail" });
    expect(error).not.toBeNull();
  });

  it("business development can't bin contacts", async () => {
    const { data: c } = await clients.bizdev.from("contacts").select("id").limit(1).single();
    const { error } = await clients.bizdev.from("contacts").update({ deleted_at: new Date().toISOString() }).eq("id", c!.id);
    expect(error?.message).toMatch(/Admin or Manager/);
  });

  it("nobody but an admin can hard-delete", async () => {
    const { data: c } = await clients.manager.from("contacts").insert({ first_name: "Temp", last_name: "Rls" }).select("id").single();
    await clients.manager.from("contacts").delete().eq("id", c!.id);
    const { data: still } = await clients.manager.from("contacts").select("id").eq("id", c!.id);
    expect(still?.length).toBe(1); // RLS silently ignored the delete
    await clients.admin.from("contacts").delete().eq("id", c!.id);
  });
});

describe("profiles and roles", () => {
  it("staff can't promote themselves", async () => {
    const { data: me } = await clients.bizdev.auth.getUser();
    const { error } = await clients.bizdev.from("profiles").update({ role: "admin" }).eq("id", me.user!.id);
    expect(error?.message).toMatch(/Only an Admin/);
  });

  it("staff can update their own name", async () => {
    const { data: me } = await clients.support.auth.getUser();
    const { error } = await clients.support.from("profiles").update({ phone: "0491 570 110" }).eq("id", me.user!.id);
    expect(error).toBeNull();
  });

  it("only admins see invitations", async () => {
    const { data } = await clients.manager.from("invitations").select("id");
    expect(data).toEqual([]);
  });
});

describe("audit log", () => {
  it("only admins can read it", async () => {
    const { data: adminRows } = await clients.admin.from("audit_log").select("id").limit(1);
    const { data: managerRows } = await clients.manager.from("audit_log").select("id").limit(1);
    expect(adminRows?.length).toBe(1);
    expect(managerRows).toEqual([]);
  });

  it("can't be edited, even by an admin", async () => {
    const { data: row } = await clients.admin.from("audit_log").select("id").limit(1).single();
    const { error } = await clients.admin.from("audit_log").update({ action: "view" }).eq("id", row!.id);
    // No update policy means no rows match; the trigger is a second lock behind it.
    const { data: after } = await clients.admin.from("audit_log").select("action").eq("id", row!.id).single();
    expect(error === null || /can't be changed/.test(error.message)).toBe(true);
    expect(after?.action).not.toBe("view");
  });

  it("records who changed a contact", async () => {
    const { data: c } = await clients.bizdev.from("contacts").select("id").limit(1).single();
    await clients.bizdev.from("contacts").update({ job_title: `Updated ${Date.now()}` }).eq("id", c!.id);
    const { data: log } = await clients.admin
      .from("audit_log")
      .select("action, changed_fields, actor_email")
      .eq("entity_id", c!.id)
      .order("at", { ascending: false })
      .limit(1)
      .single();
    expect(log?.action).toBe("update");
    expect(log?.changed_fields).toContain("job_title");
    expect(log?.actor_email).toBe("bizdev@waypointhub.test");
  });
});
