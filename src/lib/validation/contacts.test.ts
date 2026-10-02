import { describe, expect, it } from "vitest";
import { contactSchema, organisationSchema } from "./contacts";
import { safeNextPath } from "../routes";

describe("contact validation", () => {
  it("needs only a first name", () => {
    const r = contactSchema.safeParse({ first_name: "Sam" });
    expect(r.success).toBe(true);
  });
  it("rejects a blank first name with a friendly message", () => {
    const r = contactSchema.safeParse({ first_name: "  " });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/first name/i);
  });
  it("turns empty strings into nulls", () => {
    const r = contactSchema.parse({ first_name: "Sam", email: "", mobile: "" });
    expect(r.email).toBeNull();
    expect(r.mobile).toBeNull();
  });
  it("lower-cases email", () => {
    expect(contactSchema.parse({ first_name: "Sam", email: "Sam@Example.COM" }).email).toBe("sam@example.com");
  });
  it.each(["0491 570 006", "(07) 3180 0649", "+61 491 570 006", "1300 123 456", "07-5550-1234"])("accepts %s", (mobile) => {
    expect(contactSchema.safeParse({ first_name: "Sam", mobile }).success).toBe(true);
  });
  it.each(["12345", "0491 570", "not a number"])("rejects %s", (mobile) => {
    expect(contactSchema.safeParse({ first_name: "Sam", mobile }).success).toBe(false);
  });
  it("checks postcodes are 4 digits", () => {
    expect(contactSchema.safeParse({ first_name: "Sam", postcode: "4019" }).success).toBe(true);
    expect(contactSchema.safeParse({ first_name: "Sam", postcode: "40190" }).success).toBe(false);
  });
});

describe("organisation validation", () => {
  it("adds https:// to bare websites", () => {
    expect(organisationSchema.parse({ name: "Org", website: "example.org.au" }).website).toBe("https://example.org.au");
  });
  it("checks ABNs are 11 digits (spaces allowed)", () => {
    expect(organisationSchema.parse({ name: "Org", abn: "88 694 131 292" }).abn).toBe("88694131292");
    expect(organisationSchema.safeParse({ name: "Org", abn: "123" }).success).toBe(false);
  });
});

describe("login redirects stay on this site", () => {
  it("allows internal paths", () => expect(safeNextPath("/contacts")).toBe("/contacts"));
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "", null])("blocks %s", (p) => {
    expect(safeNextPath(p)).toBe("/today");
  });
});
