import type { Job } from "./jobs"
import { getSql, withRetry } from "./db"

// ---------------------------------------------------------------------------
// Jobs are REAL ROWS in links_jobs — one row per job line. Neon is the only
// source of truth: there is no bundled seed, no data/*.json fallback and no
// hardcoded dataset. Without DATABASE_URL every read/write throws.
// ---------------------------------------------------------------------------

export const NO_DB_MESSAGE = "DATABASE_URL is not configured — the dashboard reads from Neon"

export interface JobsDataset {
  jobs: Job[]
  updatedAt: string | null
  source: string
}

export interface JobsFilter {
  branch?: string
  month?: string
}

export interface JobsMeta {
  total: number
  branches: string[]
  months: string[]
  lastUpload: string | null
}

export interface UploadLogEntry {
  id: number
  branch: string
  month: string
  source: string
  uploaded_by: string | null
  uploaded_at: string
  rows_inserted: number
  rows_deleted: number
}

type Sql = NonNullable<ReturnType<typeof getSql>>

function requireSql(): Sql {
  const sql = getSql()
  if (!sql) throw new Error(NO_DB_MESSAGE)
  return sql
}

/**
 * Human-readable message for a failed data read — feed it to <DataErrorCard/>
 * so pages degrade to an inline card instead of a crashed route.
 */
export function dataErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (raw.includes("DATABASE_URL")) return NO_DB_MESSAGE
  return `Database unreachable — ${raw}`
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

/** Job columns in links_jobs, in insert order. Keep in sync with JOB_VALUES. */
const JOB_COLUMNS = [
  "branch",
  "month",
  "department",
  "service_scope",
  "job_no",
  "job_date",
  "customer",
  "cha",
  "nomination_freehand",
  "nomination_agent",
  "carrier",
  "mbl_mawb",
  "hbl_type",
  "mode",
  "containers_count",
  "container_size",
  "packages",
  "gross_wt_kg",
  "chargeable_wt_kg",
  "origin",
  "pol",
  "pod",
  "final_destination",
  "buying_inr",
  "selling_inr",
  "remarks",
  "source",
  "uploaded_by",
] as const

const SELECT_COLUMNS = JOB_COLUMNS.slice(0, -2).join(", ")

function jobValues(job: Job, source: string, uploadedBy: string | null): unknown[] {
  return [
    job.branch,
    job.month,
    job.department,
    job.service_scope,
    job.job_no,
    job.job_date === "" ? null : job.job_date,
    job.customer,
    job.cha,
    job.nomination_freehand,
    job.nomination_agent,
    job.carrier,
    job.mbl_mawb,
    job.hbl_type,
    job.mode,
    job.containers_count,
    job.container_size,
    job.packages,
    job.gross_wt_kg,
    job.chargeable_wt_kg,
    job.origin,
    job.pol,
    job.pod,
    job.final_destination,
    job.buying_inr,
    job.selling_inr,
    job.remarks,
    source,
    uploadedBy,
  ]
}

/** pg returns numeric/bigint as strings — coerce back, blanks become null. */
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? "" : String(v)
}

/** date column → "YYYY-MM-DD" ("" when null). */
function toIsoDate(v: unknown): string {
  if (v === null || v === undefined || v === "") return ""
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

type Row = Record<string, unknown>

function rowToJob(r: Row): Job {
  return {
    branch: toStr(r.branch),
    month: toStr(r.month),
    department: toStr(r.department),
    service_scope: toStr(r.service_scope),
    job_no: toStr(r.job_no),
    job_date: toIsoDate(r.job_date),
    customer: toStr(r.customer),
    cha: toStr(r.cha),
    nomination_freehand: toStr(r.nomination_freehand),
    nomination_agent: toStr(r.nomination_agent),
    carrier: toStr(r.carrier),
    mbl_mawb: toStr(r.mbl_mawb),
    hbl_type: toStr(r.hbl_type),
    mode: toStr(r.mode),
    containers_count: toNum(r.containers_count),
    container_size: toStr(r.container_size),
    packages: toNum(r.packages),
    gross_wt_kg: toNum(r.gross_wt_kg),
    chargeable_wt_kg: toNum(r.chargeable_wt_kg),
    origin: toStr(r.origin),
    pol: toStr(r.pol),
    pod: toStr(r.pod),
    final_destination: toStr(r.final_destination),
    buying_inr: toNum(r.buying_inr),
    selling_inr: toNum(r.selling_inr),
    remarks: toStr(r.remarks),
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const PAGE_SIZE = 5000

/**
 * Every job row matching the filter, paginated internally so no row cap can
 * truncate the result. Pass the page's active branch/month filter — it is
 * pushed into SQL so we never ship the whole table to a filtered view.
 */
export async function loadJobs(filter: JobsFilter = {}): Promise<JobsDataset> {
  const sql = requireSql()

  // Conditions are built from the filter KEYS only — every value is bound, so
  // the (branch, month) index is usable and nothing user-supplied is inlined.
  const where: string[] = []
  const scope: unknown[] = []
  if (filter.branch !== undefined) {
    scope.push(filter.branch)
    where.push(`branch = $${scope.length}`)
  }
  if (filter.month !== undefined) {
    scope.push(filter.month)
    where.push(`month = $${scope.length}`)
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""

  const jobs: Job[] = []
  let updatedAt: string | null = null
  let source: string | null = null

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const rows = (await withRetry(() =>
      sql.query(
        `SELECT ${SELECT_COLUMNS}, source, uploaded_at
           FROM links_jobs
           ${whereSql}
          ORDER BY month, branch, id
          LIMIT $${scope.length + 1} OFFSET $${scope.length + 2}`,
        [...scope, PAGE_SIZE, offset],
      ),
    )) as Row[]

    for (const r of rows) {
      jobs.push(rowToJob(r))
      const at = r.uploaded_at ? String(r.uploaded_at) : null
      if (at && (updatedAt === null || at > updatedAt)) {
        updatedAt = at
        source = r.source ? String(r.source) : null
      }
    }

    if (rows.length < PAGE_SIZE) break
  }

  return { jobs, updatedAt, source: source ?? (jobs.length > 0 ? "links_jobs" : "none") }
}

/**
 * Dataset shape (totals, branch + month axes, last ingest) via SQL aggregates —
 * used by headers and filter bars so they never pull rows.
 */
export async function loadJobsMeta(): Promise<JobsMeta> {
  const sql = requireSql()
  const rows = (await withRetry(() => sql`
    SELECT
      (SELECT count(*) FROM links_jobs) AS total,
      (SELECT max(uploaded_at) FROM links_jobs) AS last_upload,
      (SELECT coalesce(json_agg(b ORDER BY b), '[]'::json)
         FROM (SELECT DISTINCT branch AS b FROM links_jobs WHERE branch <> '') s) AS branches,
      (SELECT coalesce(json_agg(m ORDER BY m), '[]'::json)
         FROM (SELECT DISTINCT month AS m FROM links_jobs WHERE month <> '') s) AS months
  `)) as Row[]

  const r = rows[0] ?? {}
  return {
    total: toNum(r.total) ?? 0,
    branches: Array.isArray(r.branches) ? (r.branches as string[]) : [],
    months: Array.isArray(r.months) ? (r.months as string[]) : [],
    lastUpload: r.last_upload ? String(r.last_upload) : null,
  }
}

export async function listUploads(limit = 50): Promise<UploadLogEntry[]> {
  const sql = requireSql()
  const rows = (await withRetry(() => sql`
    SELECT id, branch, month, source, uploaded_by, uploaded_at, rows_inserted, rows_deleted
      FROM links_uploads
     ORDER BY uploaded_at DESC, id DESC
     LIMIT ${limit}
  `)) as Row[]
  return rows.map((r) => ({
    id: toNum(r.id) ?? 0,
    branch: toStr(r.branch),
    month: toStr(r.month),
    source: toStr(r.source),
    uploaded_by: r.uploaded_by === null || r.uploaded_by === undefined ? null : String(r.uploaded_by),
    uploaded_at: toStr(r.uploaded_at),
    rows_inserted: toNum(r.rows_inserted) ?? 0,
    rows_deleted: toNum(r.rows_deleted) ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const INSERT_BATCH = 500

/**
 * Multi-row INSERT for one batch. Placeholders are generated from the column
 * count only — every job value travels as a bound parameter.
 */
function insertStatement(batch: Job[], source: string, uploadedBy: string | null): { text: string; params: unknown[] } {
  const cols = JOB_COLUMNS.length
  const params: unknown[] = []
  const tuples: string[] = []

  batch.forEach((job, i) => {
    const base = i * cols
    tuples.push(`(${Array.from({ length: cols }, (_, c) => `$${base + c + 1}`).join(", ")})`)
    params.push(...jobValues(job, source, uploadedBy))
  })

  return {
    text: `INSERT INTO links_jobs (${JOB_COLUMNS.join(", ")}) VALUES ${tuples.join(", ")}`,
    params,
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Replaces one branch + month in place: deletes that slice and inserts the new
 * rows in a single transaction, so a failed upload never leaves a hole. Every
 * other branch and month is untouched. Logged to links_uploads.
 */
export async function replaceBranchMonth(
  branch: string,
  month: string,
  jobs: Job[],
  source: string,
  uploadedBy: string | null,
): Promise<{ deleted: number; inserted: number }> {
  const sql = requireSql()

  const statements = [
    sql.query(
      `WITH removed AS (DELETE FROM links_jobs WHERE branch = $1 AND month = $2 RETURNING 1)
       SELECT count(*)::int AS deleted FROM removed`,
      [branch, month],
    ),
    ...chunk(jobs, INSERT_BATCH).map((batch) => {
      const { text, params } = insertStatement(batch, source, uploadedBy)
      return sql.query(text, params)
    }),
  ]

  const results = (await withRetry(() => sql.transaction(statements))) as Row[][]
  const deleted = toNum(results[0]?.[0]?.deleted) ?? 0
  const inserted = jobs.length

  await withRetry(() => sql`
    INSERT INTO links_uploads (branch, month, source, uploaded_by, rows_inserted, rows_deleted)
    VALUES (${branch}, ${month}, ${source}, ${uploadedBy}, ${inserted}, ${deleted})
  `)

  return { deleted, inserted }
}

/** Bulk append (seeding / backfill) — chunked, no delete, no upload-log entry. */
export async function insertJobs(jobs: Job[], source: string, uploadedBy: string | null): Promise<number> {
  const sql = requireSql()
  for (const batch of chunk(jobs, INSERT_BATCH)) {
    const { text, params } = insertStatement(batch, source, uploadedBy)
    await withRetry(() => sql.query(text, params))
  }
  return jobs.length
}

/** Wipes every job row — used by `scripts/seed.ts --replace`. */
export async function truncateJobs(): Promise<void> {
  const sql = requireSql()
  await withRetry(() => sql`TRUNCATE links_jobs RESTART IDENTITY`)
}

// ---------------------------------------------------------------------------
// Fixed expenses — { [branch]: { [month]: number } }, INR per branch-month.
// Stored in links_config under the key 'expenses'. DB only.
// ---------------------------------------------------------------------------

export type ExpensesMap = Record<string, Record<string, number>>

const EXPENSES_KEY = "expenses"

export async function loadExpenses(): Promise<ExpensesMap> {
  const sql = requireSql()
  const rows = (await withRetry(() => sql`
    SELECT value FROM links_config WHERE key = ${EXPENSES_KEY}
  `)) as { value: ExpensesMap }[]
  const value = rows[0]?.value
  return value && typeof value === "object" ? value : {}
}

export async function saveExpenses(expenses: ExpensesMap): Promise<void> {
  const sql = requireSql()
  await withRetry(() => sql`
    INSERT INTO links_config (key, value, updated_at)
    VALUES (${EXPENSES_KEY}, ${JSON.stringify(expenses)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `)
}
