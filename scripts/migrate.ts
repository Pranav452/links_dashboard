// Creates the Neon tables for links-branches. Run: npx tsx scripts/migrate.ts
// No-op without DATABASE_URL (the app runs fine in file mode).
import { neon } from "@neondatabase/serverless"
import { loadEnvLocal } from "./env"

loadEnvLocal()

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log("DATABASE_URL not set — file mode, nothing to migrate.")
    return
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
  await sql`
    CREATE TABLE IF NOT EXISTS links_config (
      key        text PRIMARY KEY,
      value      jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  console.log("Migration complete: links_users, links_jobs_versions, links_config.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
