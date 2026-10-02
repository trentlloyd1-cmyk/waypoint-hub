/**
 * Fills a TEST database with fake data so you can click around safely.
 *
 *   npm run seed
 *
 * Creates four test logins (one per role, @waypointhub.test, which can't receive email)
 * plus made-up organisations and contacts. Every name, suburb and organisation here is
 * invented. Phone numbers come from the ranges the ACMA reserves for fiction.
 * Safe to run more than once.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { TEST_USERS } from "../src/lib/test-users";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
if (process.env.ALLOW_SEED !== "true") {
  console.error("Refusing to seed: set ALLOW_SEED=true in .env.local (only ever on the TEST project).");
  process.exit(1);
}

const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const SAMPLE_TAG = "Sample data";

// ACMA fictional-use mobile numbers.
const MOBILES = [
  "0491 570 006", "0491 570 156", "0491 570 157", "0491 570 158", "0491 570 159", "0491 570 110",
  "0491 570 313", "0491 570 737", "0491 571 266", "0491 571 491", "0491 571 804", "0491 572 549",
  "0491 572 665", "0491 572 983", "0491 573 770", "0491 573 087", "0491 574 118", "0491 574 632",
  "0491 575 254", "0491 575 789", "0491 576 398", "0491 576 801", "0491 577 426", "0491 577 644",
  "0491 578 957", "0491 578 148", "0491 578 888", "0491 579 212", "0491 579 760", "0491 579 455",
];
// Made-up suburbs with a Moreton Bay feel.
const SUBURBS = ["Pelican Point", "Saltwater Flats", "Banksia Rise", "Mangrove Bend", "Kookaburra Heights", "Tidewater", "Ibis Creek", "Paperbark Vale"];

type OrgSeed = Database["public"]["Tables"]["organisations"]["Insert"] & { people: [string, string, string][] };

const ORGS: OrgSeed[] = [
  {
    name: "Bayside Bridges Support Coordination", type: "support_coordination", suburb: "Pelican Point", phone: "(07) 5550 1234",
    email: "hello@baysidebridges.example", website: "https://baysidebridges.example",
    people: [["Priya", "Hendricks", "Senior Support Coordinator"], ["Callum", "Ostrowski", "Support Coordinator"], ["Jess", "Nakamura", "Team Leader"]],
  },
  {
    name: "Tidewater Plan Partners", type: "plan_management", suburb: "Tidewater", phone: "(07) 5550 2288",
    email: "plans@tidewaterpp.example",
    people: [["Marcus", "Delaney", "Plan Manager"], ["Aroha", "Whitfield", "Accounts Officer"]],
  },
  {
    name: "Pelican Point LAC Office", type: "lac", suburb: "Pelican Point", phone: "(07) 5550 3010",
    people: [["Siobhan", "Varga", "Local Area Coordinator"], ["Theo", "Bramwell", "Local Area Coordinator"]],
  },
  {
    name: "Saltwater Allied Health", type: "allied_health", suburb: "Saltwater Flats", phone: "(07) 5550 4477",
    people: [["Dr Anjali", "Fenwick", "Occupational Therapist"], ["Rhys", "Calloway", "Physiotherapist"]],
  },
  {
    name: "Banksia Carers Network", type: "carer_org", suburb: "Banksia Rise", phone: "(07) 5550 5150",
    people: [["Margaret", "Lindqvist", "Carer Support Worker"]],
  },
  {
    name: "Mangrove Bend Men's Shed", type: "community_group", suburb: "Mangrove Bend",
    people: [["Ron", "Kowalczyk", "Shed Coordinator"], ["Dave", "Mbeki", "Volunteer"]],
  },
  {
    name: "Ibis Creek Community Footy Club", type: "community_group", suburb: "Ibis Creek",
    people: [["Liam", "Fairweather", "All Abilities Coach"]],
  },
  {
    name: "Kookaburra Heights Support Co", type: "support_coordination", suburb: "Kookaburra Heights", phone: "(07) 5550 6620",
    people: [["Hannah", "Oyelaran", "Support Coordinator"], ["Ben", "Strachan", "Specialist Support Coordinator"]],
  },
];

// Family members, guardians and community contacts without an organisation.
const INDIVIDUALS: [string, string, string | null][] = [
  ["Gail", "Pemberton", "Mum of a prospective participant"],
  ["Trevor", "Ashdown", "Brother and nominee"],
  ["Kylie", "Rutherford", "Neighbour, community connector"],
  ["Mohammed", "Saleh", "Local business owner, event sponsor"],
  ["Pat", "Gallagher", null],
  ["Noel", "Brightwater", "Retired, volunteers at events"],
];

const TAGS = ["Key partner", "Newsletter", "Event sponsor", "Referrer", SAMPLE_TAG];

async function ensureTestUsers() {
  for (const u of TEST_USERS) {
    const { data: existing } = await db.from("profiles").select("id").eq("email", u.email).maybeSingle();
    if (existing) {
      console.log(`  ✓ ${u.email} already exists`);
      continue;
    }
    // The invite-only hook needs an invitation before the account can be created.
    await db.from("invitations").insert({ email: u.email, full_name: u.name, role: u.role });
    const { error } = await db.auth.admin.createUser({ email: u.email, email_confirm: true, user_metadata: { full_name: u.name } });
    if (error) throw new Error(`Couldn't create ${u.email}: ${error.message}`);
    // Test admin skips two-step so the dev sign-in buttons work without a phone.
    await db.from("profiles").update({ mfa_required: false }).eq("email", u.email);
    console.log(`  + ${u.email} (${u.role})`);
  }
}

async function main() {
  console.log("Test users:");
  await ensureTestUsers();

  const { data: admin } = await db.from("profiles").select("id").eq("email", TEST_USERS[0].email).single();
  const actorId = admin?.id ?? null;

  console.log("Tags:");
  const tagIds: Record<string, string> = {};
  for (const name of TAGS) {
    const { data: found } = await db.from("tags").select("id").eq("name", name).maybeSingle();
    tagIds[name] = found?.id ?? (await db.from("tags").insert({ name, created_by: actorId }).select("id").single()).data!.id;
  }
  console.log(`  ✓ ${TAGS.length} tags`);

  const { count } = await db.from("contact_tags").select("contact_id", { count: "exact", head: true }).eq("tag_id", tagIds[SAMPLE_TAG]);
  if ((count ?? 0) > 0) {
    console.log("Sample contacts are already there. Nothing more to do.");
    return;
  }

  console.log("Custom fields:");
  await db.from("custom_field_definitions").upsert(
    [
      { entity: "contact", key: "best_time_to_call", label: "Best time to call", field_type: "select", options: ["Morning", "Afternoon", "Evening"], position: 0 },
      { entity: "organisation", key: "service_area", label: "Service area", field_type: "text", position: 0 },
    ],
    { onConflict: "entity,key", ignoreDuplicates: true },
  );

  console.log("Organisations and people:");
  let m = 0;
  for (const { people, ...org } of ORGS) {
    const { data: o, error } = await db
      .from("organisations")
      .insert({ ...org, created_by: actorId })
      .select("id")
      .single();
    if (error || !o) throw new Error(`Organisation ${org.name}: ${error?.message}`);
    await db.from("organisation_tags").insert({ organisation_id: o.id, tag_id: tagIds[SAMPLE_TAG] });
    if (org.type === "support_coordination" || org.type === "lac") {
      await db.from("organisation_tags").insert({ organisation_id: o.id, tag_id: tagIds["Referrer"] });
    }
    await db.from("activities").insert({
      subject_type: "organisation",
      subject_id: o.id,
      type: "meeting",
      body: "Coffee catch-up to introduce our community access and peer support services. Keen to refer.",
      actor_id: actorId,
      occurred_at: new Date(Date.now() - (5 + m) * 86_400_000).toISOString(),
    });

    for (const [first, last, title] of people) {
      const domain = (org.email ?? `info@${org.name.toLowerCase().replace(/[^a-z]+/g, "")}.example`).split("@")[1];
      const { data: c } = await db
        .from("contacts")
        .insert({
          first_name: first,
          last_name: last,
          job_title: title,
          organisation_id: o.id,
          email: `${first.split(" ").pop()!.toLowerCase()}.${last.toLowerCase()}@${domain}`,
          mobile: MOBILES[m++ % MOBILES.length],
          suburb: org.suburb,
          created_by: actorId,
          custom_fields: { best_time_to_call: ["Morning", "Afternoon", "Evening"][m % 3] },
        })
        .select("id")
        .single();
      if (!c) continue;
      await db.from("contact_tags").insert({ contact_id: c.id, tag_id: tagIds[SAMPLE_TAG] });
      if (m % 3 === 0) await db.from("contact_tags").insert({ contact_id: c.id, tag_id: tagIds["Key partner"] });
      if (m % 2 === 0) await db.from("contact_tags").insert({ contact_id: c.id, tag_id: tagIds["Newsletter"] });
      await db.from("activities").insert([
        {
          subject_type: "contact",
          subject_id: c.id,
          type: "call",
          body: `Called ${first} to check in. They have a couple of participants who might suit our weekend outings.`,
          actor_id: actorId,
          occurred_at: new Date(Date.now() - m * 86_400_000).toISOString(),
        },
        { subject_type: "contact", subject_id: c.id, type: "system", body: "Added to Waypoint Hub", actor_id: actorId, occurred_at: new Date(Date.now() - (m + 10) * 86_400_000).toISOString() },
      ]);
    }
    console.log(`  + ${org.name} (${people.length} people)`);
  }

  for (const [first, last, notes] of INDIVIDUALS) {
    const { data: c } = await db
      .from("contacts")
      .insert({
        first_name: first,
        last_name: last,
        notes,
        mobile: MOBILES[m++ % MOBILES.length],
        suburb: SUBURBS[m % SUBURBS.length],
        email_opt_out: first === "Pat",
        do_not_contact: first === "Noel",
        created_by: actorId,
      })
      .select("id")
      .single();
    if (c) await db.from("contact_tags").insert({ contact_id: c.id, tag_id: tagIds[SAMPLE_TAG] });
  }
  console.log(`  + ${INDIVIDUALS.length} individuals`);

  // One deliberate near-duplicate, to try the merge tool.
  await db.from("contacts").insert({
    first_name: "Priya",
    last_name: "Hendricks",
    phone: "(07) 5550 1234",
    notes: "Entered twice by accident. Try merging me!",
    created_by: actorId,
  });
  console.log("  + 1 deliberate duplicate (Priya Hendricks) to try merging");
  console.log("\nAll done. Start the app with: npm run dev");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
