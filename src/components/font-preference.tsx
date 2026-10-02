"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Type } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const KEY = "wh_font";
type FontChoice = "nunito" | "mixed";

function apply(choice: FontChoice) {
  document.documentElement.dataset.font = choice;
}

function readChoice(): FontChoice {
  try {
    return localStorage.getItem(KEY) === "mixed" ? "mixed" : "nunito";
  } catch {
    return "nunito";
  }
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-applies the saved font choice on page load. */
export function FontPreferenceLoader() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "mixed" || saved === "nunito") apply(saved);
    } catch {}
  }, []);
  return null;
}

const SAMPLE = [
  { name: "Northside Support Coordination", refs: 14, rate: "64%", last: "28/09/2026" },
  { name: "Bayside Plan Partners", refs: 9, rate: "56%", last: "01/10/2026" },
  { name: "Redcliffe LAC Office", refs: 21, rate: "71%", last: "17/09/2026" },
];

/**
 * Temporary: compare Nunito Sans everywhere vs Nunito Sans + Inter for tables and numbers,
 * before we lock the choice in.
 */
export function FontComparison() {
  const choice = useSyncExternalStore(subscribe, readChoice, () => "nunito" as FontChoice);

  const change = (value: string) => {
    const v = value as FontChoice;
    apply(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {}
    listeners.forEach((l) => l());
  };

  return (
    <Card className="border-orange-300 dark:border-orange-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="size-5 text-orange-700 dark:text-orange-300" aria-hidden />
          Help pick our font
        </CardTitle>
        <CardDescription>
          Headings and text use Nunito Sans either way (it&apos;s the closest free match to our logo). Which reads better
          for tables and numbers? Switch and look around the app, then tell Claude which one to keep.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={choice} onValueChange={change} className="grid gap-2 sm:grid-cols-2" aria-label="Font for tables and numbers">
          <Label htmlFor="font-nunito" className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary">
            <RadioGroupItem id="font-nunito" value="nunito" />
            <span>
              <span className="block font-bold">A: Nunito Sans everywhere</span>
              <span className="block text-sm font-normal text-muted-foreground">Softer and friendlier</span>
            </span>
          </Label>
          <Label htmlFor="font-mixed" className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary">
            <RadioGroupItem id="font-mixed" value="mixed" />
            <span>
              <span className="block font-bold">B: Inter for tables and numbers</span>
              <span className="block text-sm font-normal text-muted-foreground">Crisper in dense lists</span>
            </span>
          </Label>
        </RadioGroup>
        {/* Focusable so keyboard users can scroll it sideways on a phone (WCAG 2.1.1). */}
        <div className="overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Sample table (scrolls sideways)">
          <table className="tabular w-full text-sm">
            <caption className="sr-only">Sample partner table to compare fonts</caption>
            <thead className="bg-muted text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Partner</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Referrals</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Converted</th>
                <th scope="col" className="px-3 py-2 font-semibold">Last contact</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE.map((r) => (
                <tr key={r.name} className="border-t">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-right">{r.refs}</td>
                  <td className="px-3 py-2 text-right">{r.rate}</td>
                  <td className="px-3 py-2">{r.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
