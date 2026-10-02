import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("CSV export", () => {
  const cols = [
    { key: "name", header: "Name" },
    { key: "tags", header: "Tags" },
  ];

  it("starts with a BOM so Excel reads UTF-8", () => {
    expect(toCsv([{ name: "Zoë" }], cols).charCodeAt(0)).toBe(0xfeff);
  });
  it("joins lists", () => {
    expect(toCsv([{ name: "A", tags: ["x", "y"] }], cols)).toContain("x; y");
  });
  it("neutralises spreadsheet formulas", () => {
    const csv = toCsv([{ name: "=HYPERLINK(\"http://evil\")" }], cols);
    expect(csv).toContain("'=HYPERLINK");
  });
});
