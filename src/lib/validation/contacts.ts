import { z } from "zod";

/** Empty strings from forms become null in the database. */
const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const auPhone = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => {
    if (!v) return true;
    const d = v.replace(/[\s().-]/g, "");
    // Mobiles and landlines (0X XXXX XXXX or +61), 1300/1800 and 13 numbers.
    return /^(?:\+?61|0)[2-478]\d{8}$/.test(d) || /^1[38]00\d{6}$/.test(d) || /^13\d{4}$/.test(d);
  }, "That doesn't look like an Australian phone number (e.g. 0412 345 678 or 07 3180 0649).");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => !v || z.email().safeParse(v).success, "That doesn't look like an email address. Check for typos?");

const postcode = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => !v || /^\d{4}$/.test(v), "Postcodes are 4 numbers.");

export const AU_STATES = ["QLD", "NSW", "VIC", "ACT", "TAS", "SA", "WA", "NT"] as const;

export const contactSchema = z.object({
  first_name: z.string().trim().min(1, "We need at least a first name.").max(80),
  last_name: z.string().trim().max(80).default(""),
  preferred_name: optionalText(80),
  email,
  mobile: auPhone,
  phone: auPhone,
  address_line: optionalText(200),
  suburb: optionalText(80),
  state: z.enum(AU_STATES).nullable().optional(),
  postcode,
  organisation_id: z.uuid().nullable().optional(),
  job_title: optionalText(120),
  notes: optionalText(5000),
  do_not_contact: z.boolean().default(false),
  email_opt_out: z.boolean().default(false),
  sms_opt_out: z.boolean().default(false),
  custom_fields: z.record(z.string(), z.json()).default({}),
});
export type ContactInput = z.input<typeof contactSchema>;
/** The quick-add form: everything except custom fields (edited on the contact page). */
export const contactFormSchema = contactSchema.omit({ custom_fields: true });
export type ContactFormInput = z.input<typeof contactFormSchema>;
export type ContactFormValues = z.output<typeof contactFormSchema>;
export type ContactValues = z.output<typeof contactSchema>;

export const ORGANISATION_TYPES = [
  "support_coordination",
  "plan_management",
  "lac",
  "carer_org",
  "allied_health",
  "community_group",
  "government",
  "other",
] as const;

export const organisationSchema = z.object({
  name: z.string().trim().min(1, "What's the organisation called?").max(160),
  type: z.enum(ORGANISATION_TYPES).default("other"),
  abn: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v.replace(/\s/g, "")))
    .nullable()
    .optional()
    .refine((v) => !v || /^\d{11}$/.test(v), "An ABN is 11 numbers."),
  email,
  phone: auPhone,
  website: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : /^https?:\/\//i.test(v) ? v : `https://${v}`))
    .nullable()
    .optional()
    .refine((v) => !v || z.url().safeParse(v).success, "That doesn't look like a web address."),
  address_line: optionalText(200),
  suburb: optionalText(80),
  state: z.enum(AU_STATES).nullable().optional(),
  postcode,
  notes: optionalText(5000),
  custom_fields: z.record(z.string(), z.json()).default({}),
});
export type OrganisationInput = z.input<typeof organisationSchema>;
export const organisationFormSchema = organisationSchema.omit({ custom_fields: true });
export type OrganisationFormInput = z.input<typeof organisationFormSchema>;
export type OrganisationFormValues = z.output<typeof organisationFormSchema>;
export type OrganisationValues = z.output<typeof organisationSchema>;

/** Fields that can be edited inline on a contact page, one at a time. */
export const CONTACT_INLINE_FIELDS = [
  "first_name",
  "last_name",
  "preferred_name",
  "email",
  "mobile",
  "phone",
  "address_line",
  "suburb",
  "state",
  "postcode",
  "organisation_id",
  "job_title",
  "notes",
  "do_not_contact",
  "email_opt_out",
  "sms_opt_out",
] as const;
export type ContactInlineField = (typeof CONTACT_INLINE_FIELDS)[number];

export const ORGANISATION_INLINE_FIELDS = [
  "name",
  "type",
  "abn",
  "email",
  "phone",
  "website",
  "address_line",
  "suburb",
  "state",
  "postcode",
  "notes",
] as const;
export type OrganisationInlineField = (typeof ORGANISATION_INLINE_FIELDS)[number];

export const activityNoteSchema = z.object({
  subject_type: z.enum(["contact", "organisation"]),
  subject_id: z.uuid(),
  type: z.enum(["call", "note", "meeting", "email", "sms"]),
  body: z.string().trim().min(1, "Add a few words about what happened.").max(5000),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
});

export const tagNameSchema = z.string().trim().min(1).max(40);
