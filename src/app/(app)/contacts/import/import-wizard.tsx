"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importContacts, type ImportSummary } from "./actions";
import { guessMapping, IMPORT_FIELD_LABELS, IMPORT_FIELDS, type ImportField, type ImportRow } from "./import-fields";

type Step = "upload" | "map" | "done";
const NONE = "__none__";

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, string>>>({});
  const [tagName, setTagName] = useState("");
  const [createOrgs, setCreateOrgs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    setError(null);
    if (!/\.csv$/i.test(file.name)) {
      return setError("Please choose a .csv file. In Excel or Google Sheets, use File → Save as / Download → CSV.");
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const cols = (result.meta.fields ?? []).filter(Boolean);
        if (!cols.length || !result.data.length) return setError("That file looks empty. Check it has a header row and some data.");
        setFileName(file.name);
        setHeaders(cols);
        setData(result.data);
        setMapping(guessMapping(cols));
        setTagName(`Imported ${new Date().toLocaleDateString("en-AU", { month: "short", year: "numeric" })}`);
        setStep("map");
      },
      error: () => setError("We couldn't read that file. Is it a CSV?"),
    });
  };

  const rows: ImportRow[] = data.map((r) => {
    const out: ImportRow = {};
    for (const field of IMPORT_FIELDS) {
      const col = mapping[field];
      if (col) out[field] = (r[col] ?? "").trim();
    }
    return out;
  });

  const runImport = () =>
    startTransition(async () => {
      if (!mapping.first_name) {
        setError("Choose which column holds first names. It's the only one we need.");
        return;
      }
      setError(null);
      const result = await importContacts(rows, { tagName, createOrganisations: createOrgs });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary(result.data);
      setStep("done");
      toast.success(`Nice work: ${result.data.added} contacts imported.`);
    });

  if (step === "upload") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>1. Choose your spreadsheet</CardTitle>
          <CardDescription>
            Save it as a CSV first. The top row should have column names like &ldquo;First name&rdquo;, &ldquo;Email&rdquo; or
            &ldquo;Mobile&rdquo;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            htmlFor="csv-file"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) readFile(file);
            }}
            className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center hover:bg-muted/50 focus-within:outline-3 focus-within:outline-ring"
          >
            <Upload className="size-10 text-primary" aria-hidden />
            <span className="font-semibold">Drop your CSV here, or click to choose a file</span>
            <span className="text-sm text-muted-foreground">Up to 2,000 rows at a time</span>
            <input
              ref={fileInput}
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readFile(file);
              }}
            />
          </label>
          {error && (
            <p role="alert" className="font-medium text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === "done" && summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-6 text-success" aria-hidden /> Import finished
          </CardTitle>
          <CardDescription>
            Added <strong className="text-foreground">{summary.added}</strong> contacts
            {summary.organisationsCreated > 0 && <> and {summary.organisationsCreated} new organisations</>}.
            {summary.skipped.length > 0 && <> {summary.skipped.length} rows were skipped (listed below).</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary.skipped.length > 0 && (
            <div className="max-h-80 overflow-auto rounded-lg border" tabIndex={0} role="region" aria-label="Skipped rows">
              <table className="w-full text-sm">
                <caption className="sr-only">Rows that were skipped</caption>
                <thead className="sticky top-0 bg-muted text-left">
                  <tr>
                    <th scope="col" className="px-3 py-2">Row</th>
                    <th scope="col" className="px-3 py-2">Name</th>
                    <th scope="col" className="px-3 py-2">Why it was skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.skipped.map((s, i) => (
                    <tr key={i} className="border-t">
                      <td className="tabular px-3 py-2">{s.row || "-"}</td>
                      <td className="px-3 py-2">{s.name}</td>
                      <td className="px-3 py-2">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/contacts">See your contacts</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStep("upload");
                setSummary(null);
                setData([]);
              }}
            >
              Import another file
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" aria-hidden /> 2. Match the columns
          </CardTitle>
          <CardDescription>
            {fileName}: {data.length} rows. We&apos;ve guessed where we could. Only first name is required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {IMPORT_FIELDS.map((field) => (
              <div key={field} className="grid grid-cols-[9rem_1fr] items-center gap-3">
                <Label htmlFor={`map-${field}`} className="font-semibold">
                  {IMPORT_FIELD_LABELS[field]}
                  {field === "first_name" && <span className="text-destructive"> *</span>}
                </Label>
                <select
                  id={`map-${field}`}
                  value={mapping[field] ?? NONE}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field]: e.target.value === NONE ? undefined : e.target.value }))
                  }
                  className="h-10 rounded-lg border border-input bg-background px-3"
                >
                  <option value={NONE}>Don&apos;t import</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Check the preview</CardTitle>
          <CardDescription>The first 5 rows, as they&apos;ll be saved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Import preview">
            <table className="tabular w-full text-sm">
              <caption className="sr-only">Preview of the first 5 rows</caption>
              <thead className="bg-muted text-left">
                <tr>
                  {IMPORT_FIELDS.filter((f) => mapping[f]).map((f) => (
                    <th key={f} scope="col" className="px-3 py-2 whitespace-nowrap">
                      {IMPORT_FIELD_LABELS[f]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t">
                    {IMPORT_FIELDS.filter((f) => mapping[f]).map((f) => (
                      <td key={f} className="px-3 py-2 whitespace-nowrap">
                        {r[f]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="import-tag" className="font-semibold">
                Tag everyone in this import
              </Label>
              <Input id="import-tag" value={tagName} onChange={(e) => setTagName(e.target.value)} />
              <p className="text-sm text-muted-foreground">Handy for finding this batch later. Leave blank for no tag.</p>
            </div>
            {mapping.organisation_name && (
              <div className="flex items-start gap-3 pt-7">
                <Checkbox id="create-orgs" checked={createOrgs} onCheckedChange={(c) => setCreateOrgs(c === true)} />
                <Label htmlFor="create-orgs" className="block font-normal">
                  <span className="block font-semibold">Add organisations we don&apos;t have yet</span>
                  <span className="block text-sm text-muted-foreground">Otherwise unknown organisations are left blank.</span>
                </Label>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            Rows with an email or phone number that&apos;s already in Waypoint Hub are skipped, and you&apos;ll get a list.
          </p>

          {error && (
            <p role="alert" className="font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={runImport} disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Import {data.length} contacts
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setStep("upload")} disabled={pending}>
              Choose a different file
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
