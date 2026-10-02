# Waypoint Hub

The growth hub for **Waypoint Connect**: enquiries, referrals, partners, calendar, messages, news, community events and social media, in one simple place.

Care records, rostering, timesheets, progress notes and invoicing stay in **ShiftCare**. Waypoint Hub only keeps what's needed to manage enquiries and relationships.

---

## What's built so far

**Phase 1: Foundation** ✅
- Invite-only sign-in: email link or 6-digit code (Google sign-in ready to switch on), with two-step sign-in required for Admins
- Four roles (Admin, Manager, Business Development, Support Staff), enforced inside the database
- App layout: sidebar, phone tab bar, Ctrl/Cmd + K search, orange "+ New" button, Today screen, first-login tour
- Contacts and organisations: add, inline edit, tags, custom fields, activity timeline, duplicate warnings, merge, bin with 30-day restore, CSV import and export
- Audit log of who viewed, changed, exported or deleted what
- Signs people out after 30 minutes idle
- Brand theme (light and dark), WCAG 2.2 AA colour contrast, app icons

Phases 2 to 5 are listed in the plan and on each "Coming in Phase X" screen.

---

## Running it on your computer

You need **Node.js** (LTS) and **Git** installed. Open a terminal in this folder.

### 1. One-time setup

```bash
npm install
```

### 2. Connect your TEST Supabase project

1. In Supabase, open your **waypoint-hub-dev** project.
2. Go to **Project Settings → API Keys**. Copy the **publishable** key and the **secret** key.
3. Go to **Project Settings → Data API** and copy the **Project URL**.
4. Open the file `.env.local` in this folder and paste those 3 values in. Never share the secret key or put it in chat.

### 3. Set up the database

This links the project and creates all the tables and security rules:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR-PROJECT-REF
```

(The project ref is the part of your Project URL before `.supabase.co`.)

```bash
npx supabase db push
```

```bash
npx supabase config push
```

`config push` copies the sign-in settings (invite-only rule, branded emails, allowed web addresses) to Supabase.

### 4. Add fake data and make yourself an Admin

```bash
npm run seed
```

```bash
npm run add-admin -- you@waypointconnect.org "Your Name"
```

### 5. Start the app

```bash
npm run dev
```

Open http://localhost:3000. On the test project you'll see **Test mode** buttons on the sign-in page, so you can sign in as each role without email.

---

## Checks and tests

| Command | What it does |
|---|---|
| `npm run check` | Type check, lint and unit tests (fast, no database) |
| `npm run test:rls` | Signs in as each test role and checks what the database allows (needs the seeded test project) |
| `npm run test:e2e` | Clicks through the app in a real browser on desktop and phone sizes, including accessibility (axe) checks |

First time running end-to-end tests: `npx playwright install chromium`.

---

## Going live (Phase 1 checklist)

These are done once, in this order. Claude will walk you through each one.

1. **Live Supabase project**: a second project, `waypoint-hub`, region **Sydney**, on the **Pro** plan (needed for session timeouts, two-step sign-in, backups). Repeat steps 3 and 4 above against it, **without** `npm run seed`, and leave `ALLOW_SEED` and `ENABLE_DEV_LOGIN` off.
2. **Email sending**: Supabase's built-in email only works for testing. In Supabase → **Authentication → Emails → SMTP**, use Google Workspace: host `smtp.gmail.com`, port `587`, a sending account such as `noreply@waypointconnect.org` and a Google **app password** for it.
3. **Vercel**: import the GitHub repository, set the region to **Sydney (syd1)**, and add the same environment variables as `.env.local` (with the live project's values and `NEXT_PUBLIC_SITE_URL=https://waypointhub.org`).
4. **Domain (Hostinger)**: in Vercel, add `waypointhub.org`. Vercel shows the DNS records to add. Usually that's an **A** record for `@` pointing to `76.76.21.21` and a **CNAME** for `www` pointing to `cname.vercel-dns.com`. Add them in Hostinger → Domains → DNS / Nameservers.
5. **Google sign-in (optional)**: create an OAuth client in Google Cloud Console, paste its ID and secret into Supabase → Authentication → Sign In / Providers → Google, then set `NEXT_PUBLIC_GOOGLE_SIGNIN=true`.

---

## How it's put together (for the curious)

- **Next.js 16** (App Router, TypeScript strict) on **Vercel**, Sydney
- **Supabase** (Postgres, Auth, Storage, Realtime), Sydney. Every table has Row Level Security
- **Tailwind CSS** + **shadcn/ui**, themed in `src/app/globals.css`
- Database changes live in `supabase/migrations/`. Never edit a migration that's already been pushed: add a new one
- Server Actions validate everything with **Zod** (`src/lib/validation/`)
- Brand assets are generated from `brand/` with `npm run brand`

All times are Australia/Brisbane and dates are DD/MM/YYYY.
