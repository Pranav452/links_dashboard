@AGENTS.md

## Project context

LINKS internal branch-productivity dashboard ("LINKS Branch Analytics") — HQ management view of jobs, GP, and department mix across all branches. Sibling of the vipar dashboard (C:\development-manilal\vipar): same conventions, same monochrome + emerald design language.

- **Stack:** Next.js 16 / React 19 / TypeScript, Tailwind 4 (shadcn-style ui primitives), next-themes (dark default), SheetJS/xlsx, Neon Postgres (optional — degrades to data/*.json file mode without DATABASE_URL).
- **Run:** `npm install && npm run dev` → :3000. Seed data: `npx tsx scripts/seed.ts` (reads the normalized-jobs.json export, writes data/jobs.json + DB version if configured). DB tables: `npx tsx scripts/migrate.ts`.
- **Logins (fallback, no DB):** `links`/`links` (viewer), `admin`/`admin123` (admin). Env overrides: LINKS_USER/LINKS_PASS/LINKS_ADMIN_USER/LINKS_ADMIN_PASS. With DATABASE_URL set, users live in `links_users` (scrypt hashes via lib/password.ts).
- **Auth:** stateless HMAC session cookie `links_session` (lib/auth.ts), gated by proxy.ts — /dashboard needs a session, /admin needs the admin role. Signed with AUTH_SECRET from .env.local.
- **Data flow:** Job rows (lib/jobs.ts type) → lib/store.ts `loadJobs()` priority: active `links_jobs_versions` row (jobs jsonb) → data/jobs.json → empty. `saveJobs()` appends + activates a version (DB) or overwrites the file. Fixed expenses per branch-month: `loadExpenses()/saveExpenses()` in `links_config` key `expenses` or data/expenses.json.
- **Watch out:** `.env.local` (AUTH_SECRET, DATABASE_URL) and `data/` are gitignored runtime state — don't commit either. xlsx carries a known upstream advisory (same as vipar).
