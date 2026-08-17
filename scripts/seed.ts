// Seeds the jobs dataset from the normalized branch-productivity JSON.
// Run: npx tsx scripts/seed.ts
// Writes data/jobs.json always; also pushes a version to Neon when
// DATABASE_URL is set (run scripts/migrate.ts first in that case).
import { promises as fs } from "node:fs"
import path from "node:path"

import { neon } from "@neondatabase/serverless"
import { loadEnvLocal } from "./env"

loadEnvLocal()

const SOURCE = process.argv[2] ?? "C:\\Users\\Manilal\\Downloads\\LINKS Branch Data (Normalized)\\normalized-jobs.json"
const DATA_DIR = path.join(process.cwd(), "data")
const JOBS_FILE = path.join(DATA_DIR, "jobs.json")

async function main() {
  const raw = JSON.parse(await fs.readFile(SOURCE, "utf8"))
  if (!Array.isArray(raw)) throw new Error(`Expected a JSON array in ${SOURCE}`)
  console.log(`Read ${raw.length} jobs from ${SOURCE}`)

  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    JOBS_FILE,
    JSON.stringify({ jobs: raw, updatedAt: new Date().toISOString(), source: "seed:normalized-jobs.json" }, null, 2),
  )
  console.log(`Wrote ${JOBS_FILE}`)

  const url = process.env.DATABASE_URL
  if (url) {
    const sql = neon(url)
    const inserted = (await sql`
      INSERT INTO links_jobs_versions (source, uploaded_by, job_count, jobs, active)
      VALUES ('seed:normalized-jobs.json', 'seed-script', ${raw.length}, ${JSON.stringify(raw)}::jsonb, false)
      RETURNING id
    `) as { id: number }[]
    const id = inserted[0].id
    await sql.transaction([
      sql`UPDATE links_jobs_versions SET active = false WHERE active = true`,
      sql`UPDATE links_jobs_versions SET active = true WHERE id = ${id}`,
    ])
    console.log(`Inserted + activated DB version ${id}`)
  } else {
    console.log("DATABASE_URL not set — file mode only.")
  }

  // quick sanity summary
  const branches = new Map<string, number>()
  for (const j of raw) branches.set(j.branch, (branches.get(j.branch) ?? 0) + 1)
  console.log("Jobs per branch:", Object.fromEntries([...branches.entries()].sort()))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
