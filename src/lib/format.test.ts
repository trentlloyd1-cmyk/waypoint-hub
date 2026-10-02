import { describe, expect, it } from "vitest";
import { displayName, formatDate, formatDateTime, formatPhone, initials } from "./format";

describe("dates are Brisbane time, DD/MM/YYYY", () => {
  it("formats a UTC timestamp as the Brisbane calendar day", () => {
    // 2 Oct 2026 16:30 UTC is 3 Oct 2026 02:30 in Brisbane (UTC+10, no daylight saving).
    expect(formatDate("2026-10-02T16:30:00Z")).toBe("03/10/2026");
  });
  it("shows 12-hour time with am/pm", () => {
    expect(formatDateTime("2026-10-02T05:45:00Z")).toBe("02/10/2026, 3:45 pm");
  });
  it("handles empty values", () => {
    expect(formatDate(null)).toBe("");
  });
});

describe("phone numbers", () => {
  it("formats mobiles", () => expect(formatPhone("0491570006")).toBe("0491 570 006"));
  it("formats +61 mobiles", () => expect(formatPhone("+61491570006")).toBe("0491 570 006"));
  it("formats Brisbane landlines", () => expect(formatPhone("0731800649")).toBe("(07) 3180 0649"));
  it("leaves unknown formats alone", () => expect(formatPhone("12345")).toBe("12345"));
});

describe("names", () => {
  it("shows preferred name in brackets when different", () => {
    expect(displayName({ first_name: "Robert", last_name: "Smith", preferred_name: "Bob" })).toBe("Robert Smith (Bob)");
  });
  it("skips preferred name when it matches", () => {
    expect(displayName({ first_name: "Bob", last_name: "Smith", preferred_name: "Bob" })).toBe("Bob Smith");
  });
  it("makes initials", () => expect(initials("Trent Lloyd")).toBe("TL"));
});
