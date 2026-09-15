// Creates the Neon tables for links-branches. Run: npx tsx scripts/migrate.ts
// Idempotent — safe to re-run. Requires DATABASE_URL (the dashboard is DB-only).
import { neon } from "@neondatabase/serverless"
import { installPublicDnsFallback, loadEnvLocal } from "./env"

loadEnvLocal()
installPublicDnsFallback()

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not configured — set it in .env.local before migrating.")
  }
  const sql = neon(url)

  await sql`
    CREATE TABLE IF NOT EXISTS links_users (
      username      text PRIMARY KEY,
      password_hash text NOT NULL,
      role          text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'admin')),
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `

  // -------------------------------------------------------------------------
  // links_jobs — one ROW per job line. This is the single source of truth for
  // every dashboard read. Grows to tens of thousands of rows; browse it in the
  // Neon console like any normal table.
  // -------------------------------------------------------------------------
  await sql`
    CREATE TABLE IF NOT EXISTS links_jobs (
      id                  bigserial PRIMARY KEY,
      branch              text NOT NULL,
      month               text NOT NULL,
      department          text,
      service_scope       text,
      job_no              text,
      job_date            date,
      customer            text,
      cha                 text,
      nomination_freehand text,
      nomination_agent    text,
      carrier             text,
      mbl_mawb            text,
      hbl_type            text,
      mode                text,
      containers_count    integer,
      container_size      text,
      packages            integer,
      gross_wt_kg         numeric,
      chargeable_wt_kg    numeric,
      origin              text,
      pol                 text,
      pod                 text,
      final_destination   text,
      buying_inr          numeric,
      selling_inr         numeric,
      remarks             text,
      source              text,
      uploaded_by         text,
      uploaded_at         timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS links_jobs_branch_month_idx ON links_jobs (branch, month)`
  await sql`CREATE INDEX IF NOT EXISTS links_jobs_month_idx ON links_jobs (month)`
  await sql`CREATE INDEX IF NOT EXISTS links_jobs_pod_idx ON links_jobs (pod)`
  await sql`CREATE INDEX IF NOT EXISTS links_jobs_customer_idx ON links_jobs (customer)`

  // Duplicate / non-shipment rows copied from the branch sheets are HIDDEN,
  // never deleted: excluded_reason is set by lib/dedup.ts (scripts/dedup.ts and
  // every admin upload). Every dashboard read filters excluded_reason IS NULL.
  await sql`ALTER TABLE links_jobs ADD COLUMN IF NOT EXISTS excluded_reason text NULL`
  await sql`ALTER TABLE links_jobs ADD COLUMN IF NOT EXISTS excluded_at timestamptz NULL`
  await sql`
    CREATE INDEX IF NOT EXISTS links_jobs_visible_branch_month_idx
      ON links_jobs (branch, month) WHERE excluded_reason IS NULL
  `

  // -------------------------------------------------------------------------
  // links_uploads — append-only ingest log (replaces the old version history).
  // Rollback = re-upload that branch + month, which is scoped and safe.
  // -------------------------------------------------------------------------
  await sql`
    CREATE TABLE IF NOT EXISTS links_uploads (
      id            bigserial PRIMARY KEY,
      branch        text NOT NULL,
      month         text NOT NULL,
      source        text NOT NULL,
      uploaded_by   text,
      uploaded_at   timestamptz NOT NULL DEFAULT now(),
      rows_inserted integer NOT NULL DEFAULT 0,
      rows_deleted  integer NOT NULL DEFAULT 0
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS links_uploads_uploaded_at_idx ON links_uploads (uploaded_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS links_config (
      key        text PRIMARY KEY,
      value      jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `

  // -------------------------------------------------------------------------
  // LEGACY — links_jobs_versions stored the whole dataset as one jsonb blob per
  // version. Nothing reads or writes it any more (links_jobs replaced it). It
  // is still created here so old deployments/backups keep resolving; drop it
  // manually once the historic blobs are no longer wanted.
  // -------------------------------------------------------------------------
  await sql`
    CREATE TABLE IF NOT EXISTS links_jobs_versions (
      id          serial PRIMARY KEY,
      source      text NOT NULL,
      uploaded_by text,
      uploaded_at timestamptz NOT NULL DEFAULT now(),
      job_count   integer NOT NULL DEFAULT 0,
      jobs        jsonb NOT NULL,
      active      boolean NOT NULL DEFAULT false
    )
  `

  console.log("Migration complete: links_users, links_jobs (+ excluded_reason/excluded_at), links_uploads, links_config (+ legacy links_jobs_versions).")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
