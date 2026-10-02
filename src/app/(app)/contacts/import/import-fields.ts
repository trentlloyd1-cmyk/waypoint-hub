/** Columns a spreadsheet can be matched to, with the header names we recognise automatically. */
export const IMPORT_FIELDS = [
  "first_name",
  "last_name",
  "preferred_name",
  "email",
  "mobile",
  "phone",
  "job_title",
  "organisation_name",
  "address_line",
  "suburb",
  "state",
  "postcode",
  "notes",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ImportRow = Partial<Record<ImportField, string>>;

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  first_name: "First name",
  last_name: "Last name",
  preferred_name: "Preferred name",
  email: "Email",
  mobile: "Mobile",
  phone: "Other phone",
  job_title: "Job title",
  organisation_name: "Organisation",
  address_line: "Street address",
  suburb: "Suburb",
  state: "State",
  postcode: "Postcode",
  notes: "Notes",
};

const GUESSES: Record<ImportField, string[]> = {
  first_name: ["first name", "firstname", "given name", "first"],
  last_name: ["last name", "lastname", "surname", "family name", "last"],
  preferred_name: ["preferred name", "nickname", "known as"],
  email: ["email", "email address", "e-mail"],
  mobile: ["mobile", "mobile phone", "cell", "mobile number"],
  phone: ["phone", "telephone", "work phone", "landline", "phone number"],
  job_title: ["job title", "title", "position", "role"],
  organisation_name: ["organisation", "organization", "company", "employer", "provider", "business"],
  address_line: ["address", "street", "street address", "address line 1"],
  suburb: ["suburb", "city", "town", "locality"],
  state: ["state"],
  postcode: ["postcode", "post code", "zip", "postal code"],
  notes: ["notes", "note", "comments"],
};

/** Best guess at which spreadsheet column fills each field. */
export function guessMapping(headers: string[]): Partial<Record<ImportField, string>> {
  const mapping: Partial<Record<ImportField, string>> = {};
  const used = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    const match = headers.find((h) => !used.has(h) && GUESSES[field].includes(h.trim().toLowerCase()));
    if (match) {
      mapping[field] = match;
      used.add(match);
    }
  }
  return mapping;
}
