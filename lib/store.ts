import { promises as fs } from "node:fs"
import path from "node:path"

import type { Job } from "./jobs"
import { getSql, withRetry } from "./db"

const DATA_DIR = path.join(process.cwd(), "data")
const JOBS_FILE = path.join(DATA_DIR, "jobs.json")
// Git-tracked bundled seed (Apr–Jul 2026 normalized history) so a fresh
// deployment shows data before the DB holds any version.
const SEED_FILE = path.join(DATA_DIR, "seed-jobs.json")
const EXPENSES_FILE = path.join(DATA_DIR, "expenses.json")

// ---------------------------------------------------------------------------
// Jobs dataset — versioned in Neon (links_jobs_versions), file fallback.
// Priority: active version in Neon → data/jobs.json → bundled seed → empty.
// ---------------------------------------------------------------------------

export interface JobsDataset {
  jobs: Job[]
  updatedAt: string | null
  source: string
  versionId: number | null
}

export interface JobsVersion {
  id: number
  source: string
  uploaded_at: string
  uploaded_by: string | null
  job_count: number
  active: boolean
}

const EMPTY: JobsDataset = { jobs: [], updatedAt: null, source: "none", versionId: null }

export async function loadJobs(): Promise<JobsDataset> {
  const sql = getSql()
  if (sql) {
    try {
      const rows = (await withRetry(() => sql`
        SELECT id, source, uploaded_at, jobs
        FROM links_jobs_versions WHERE active = true
        ORDER BY uploaded_at DESC LIMIT 1
      `)) as { id: number; source: string; uploaded_at: string; jobs: Job[] }[]
      if (rows.length > 0) {
        const row = rows[0]
        return { jobs: row.jobs, updatedAt: row.uploaded_at, source: row.source, versionId: row.id }
      }
    } catch (err) {
      console.error("loadJobs db error:", err)
    }
  }

  for (const file of [JOBS_FILE, SEED_FILE]) {
    try {
      const raw = JSON.parse(await fs.readFile(file, "utf8")) as Partial<JobsDataset>
      if (Array.isArray(raw.jobs)) {
        return {
          jobs: raw.jobs as Job[],
          updatedAt: raw.updatedAt ?? null,
          source: raw.source ?? (file === SEED_FILE ? "bundled-seed" : "file"),
          versionId: null,
        }
      }
    } catch {
      // fall through to next fallback
    }
  }
  return EMPTY
}

/** Bundled seed dataset (git-tracked), for the one-time DB seeding action. */
export async function loadBundledSeed(): Promise<Job[]> {
  const raw = JSON.parse(await fs.readFile(SEED_FILE, "utf8")) as Partial<JobsDataset>
  if (!Array.isArray(raw.jobs)) throw new Error("Bundled seed missing or malformed")
  return raw.jobs as Job[]
}

/**
 * Persist a jobs upload. With the DB configured this appends a new version and
 * makes it active (previous versions are kept for rollback); without it,
 * data/jobs.json is overwritten.
 */
export async function saveJobs(jobs: Job[], source: string, uploadedBy: string | null): Promise<number | null> {
  const sql = getSql()
  if (sql) {
    const inserted = (await withRetry(() => sql`
      INSERT INTO links_jobs_versions (source, uploaded_by, job_count, jobs, active)
      VALUES (${source}, ${uploadedBy}, ${jobs.length}, ${JSON.stringify(jobs)}::jsonb, false)
      RETURNING id
    `)) as { id: number }[]
    const id = inserted[0].id
    await activateVersion(id)
    return id
  }

  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    JOBS_FILE,
    JSON.stringify({ jobs, updatedAt: new Date().toISOString(), source }, null, 2),
  )
  return null
}

export async function listVersions(): Promise<JobsVersion[]> {
  const sql = getSql()
  if (!sql) return []
  return (await withRetry(() => sql`
    SELECT id, source, uploaded_at, uploaded_by, job_count, active
    FROM links_jobs_versions ORDER BY uploaded_at DESC
  `)) as JobsVersion[]
}

export async function activateVersion(id: number): Promise<void> {
  const sql = getSql()
  if (!sql) throw new Error("Database not configured")
  await withRetry(() =>
    sql.transaction([
      sql`UPDATE links_jobs_versions SET active = false WHERE active = true`,
      sql`UPDATE links_jobs_versions SET active = true WHERE id = ${id}`,
    ]),
  )
}

// ---------------------------------------------------------------------------
// Fixed expenses — { [branch]: { [month]: number } }, INR per branch-month.
// Stored in the links_config table (key 'expenses') or data/expenses.json.
// ---------------------------------------------------------------------------

export type ExpensesMap = Record<string, Record<string, number>>

const EXPENSES_KEY = "expenses"

export async function loadExpenses(): Promise<ExpensesMap> {
  const sql = getSql()
  if (sql) {
    try {
      const rows = (await withRetry(() => sql`
        SELECT value FROM links_config WHERE key = ${EXPENSES_KEY}
      `)) as { value: ExpensesMap }[]
      if (rows.length > 0 && rows[0].value && typeof rows[0].value === "object") {
        return rows[0].value
      }
    } catch (err) {
      console.error("loadExpenses db error:", err)
    }
  }

  try {
    const raw = JSON.parse(await fs.readFile(EXPENSES_FILE, "utf8")) as ExpensesMap
    if (raw && typeof raw === "object") return raw
  } catch {
    // fall through
  }
  return {}
}

export async function saveExpenses(expenses: ExpensesMap): Promise<void> {
  const sql = getSql()
  if (sql) {
    await withRetry(() => sql`
      INSERT INTO links_config (key, value, updated_at)
      VALUES (${EXPENSES_KEY}, ${JSON.stringify(expenses)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `)
    return
  }

  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(EXPENSES_FILE, JSON.stringify(expenses, null, 2))
}
