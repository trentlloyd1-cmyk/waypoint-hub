@AGENTS.md

# Waypoint Hub: project notes

Growth CRM for Waypoint Connect (disability and aged care support, Clontarf QLD). The owner, Trent, isn't a developer: explain decisions in plain English, and finish each build phase with what's working, how to test it, and what he needs to set up.

The approved plan, including the phase list and the ShiftCare endpoints, is in the brief and the plan file. ShiftCare stays the source of truth for care data: never store clinical or care information here.

## Conventions
- Australian English in all UI text. Warm, plain, non-corporate ("Nice work, that referral's logged").
- Times stored in UTC, shown in Australia/Brisbane via `src/lib/format.ts`. Dates DD/MM/YYYY.
- Permissions are enforced by RLS in `supabase/migrations/`. `src/lib/permissions.ts` only decides what the UI shows.
- Server Actions return `ActionResult` (`src/lib/action-result.ts`), validate with Zod, and never leak personal data in errors or logs.
- Colours: use theme tokens (`primary`, `cta`, `muted-foreground`…). Brand teal/orange fail AA for small text; see the note at the top of `globals.css`.
- New schema = new migration file. Run `npm run check` before finishing.
- Windows: edit files with the editor tools or Node, not PowerShell `Get-Content`/`Set-Content` (PowerShell 5.1 garbles UTF-8 and adds a BOM).
