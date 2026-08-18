// Bulk-loads the normalized branch-productivity JSON into the links_jobs table.
//
//   npx tsx scripts/seed.ts [path/to/normalized-jobs.json] [--replace]
//
// --replace truncates links_jobs first (full reload). Without it rows are
// appended. Requires DATABASE_URL — there is no file mode: Neon is the only
// store. Run scripts/migrate.ts first.
import { promises as fs } from "node:fs"

import { loadEnvLocal } from "./env"

loadEnvLocal()

const DEFAULT_SOURCE =
  "C:\\Users\\Manilal\\Downloads\\LINKS Branch Data (Normalized)\\normalized-jobs.json"

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured — seeding writes to Neon only.")
  }

  // Import after loadEnvLocal() so the lazily-created Neon client sees the URL.
  const { insertJobs, truncateJobs } = await import("../lib/store")
  const { normalizeJob } = await import("../lib/jobs")

  const args = process.argv.slice(2)
  const replace = args.includes("--replace")
  const file = args.find((a) => !a.startsWith("--")) ?? DEFAULT_SOURCE

  const raw = JSON.parse(await fs.readFile(file, "utf8"))
  if (!Array.isArray(raw)) throw new Error(`Expected a JSON array in ${file}`)
  const jobs = raw.map(normalizeJob)
  console.log(`Read ${jobs.length} jobs from ${file}`)

  if (replace) {
    await truncateJobs()
    console.log("Truncated links_jobs (--replace).")
  }

  const inserted = await insertJobs(jobs, `seed:${file.split(/[\\/]/).pop()}`, "seed-script")
  console.log(`Inserted ${inserted} rows into links_jobs.`)

  const perBranch = new Map<string, number>()
  for (const j of jobs) perBranch.set(j.branch, (perBranch.get(j.branch) ?? 0) + 1)
  console.log("Jobs per branch:", Object.fromEntries([...perBranch.entries()].sort()))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
