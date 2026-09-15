// Hides duplicate / non-shipment rows in links_jobs (lib/dedup.ts rules).
// Rows are NEVER deleted — flagged rows get excluded_reason + excluded_at and
// every dashboard read skips them.
//
//   npx tsx scripts/dedup.ts            dry run (default): per-branch counts only
//   npx tsx scripts/dedup.ts --apply    back up flags, then persist in ONE transaction
//
// --apply first writes backups/dedup-<date>.json (every row id + its current
// excluded state), then clears all previous flags and sets the new ones, so a
// re-run converges to the same state. Run scripts/migrate.ts first.
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { installPublicDnsFallback, loadEnvLocal } from "./env"

loadEnvLocal()
installPublicDnsFallback()

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.")
  const apply = process.argv.includes("--apply")

  const { loadDedupRows, persistExclusions } = await import("../lib/store")
  const { flagDuplicates, reasonBucket } = await import("../lib/dedup")

  const rows = await loadDedupRows()
  const flags = flagDuplicates(rows) as Map<number, string>
  const branchOf = new Map(rows.map((r) => [r.id, r.branch]))

  const per = new Map<string, { rows: number; flagged: number; current: number; reasons: Record<string, number> }>()
  for (const r of rows) {
    const e = per.get(r.branch) ?? { rows: 0, flagged: 0, current: 0, reasons: {} }
    e.rows++
    if (r.excluded_reason !== null) e.current++
    per.set(r.branch, e)
  }
  for (const [id, reason] of flags) {
    const e = per.get(branchOf.get(id)!)!
    e.flagged++
    const b = reasonBucket(reason)
    e.reasons[b] = (e.reasons[b] ?? 0) + 1
  }

  console.log(`${apply ? "APPLY" : "DRY RUN"} · ${rows.length} rows · ${flags.size} flagged\n`)
  console.log("BRANCH       rows  flagged  visible  (currently hidden)  reasons")
  for (const [branch, e] of [...per].sort((a, b) => b[1].flagged - a[1].flagged)) {
    const reasons = Object.entries(e.reasons).map(([k, v]) => `${k} ${v}`).join(", ")
    console.log(
      `${branch.padEnd(11)} ${String(e.rows).padStart(5)}  ${String(e.flagged).padStart(7)}  ${String(e.rows - e.flagged).padStart(7)}  ${String(e.current).padStart(18)}  ${reasons}`,
    )
  }

  if (!apply) {
    console.log("\nDry run only — re-run with --apply to persist.")
    return
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const dir = path.join(process.cwd(), "backups")
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `dedup-${stamp}.json`)
  writeFileSync(
    file,
    JSON.stringify({
      takenAt: new Date().toISOString(),
      rows: rows.map((r) => ({ id: r.id, branch: r.branch, month: r.month, excluded_reason: r.excluded_reason })),
    }),
  )
  console.log(`\nBackup written: ${file} (${rows.length} rows)`)

  const { hidden, cleared } = await persistExclusions(flags)
  console.log(`Applied in one transaction: ${hidden} rows hidden, ${cleared} previous flags cleared.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
