import Papa from "papaparse";

/**
 * Stops spreadsheet "formula injection": a cell starting with = + - @ could run as a formula
 * when someone opens the export in Excel.
 */
function safeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = Array.isArray(value) ? value.join("; ") : String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns: { key: string; header: string }[]) {
  const data = rows.map((r) => columns.map((c) => safeCell(r[c.key])));
  // BOM so Excel opens it as UTF-8 (names with accents stay intact).
  return "﻿" + Papa.unparse({ fields: columns.map((c) => c.header), data });
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
