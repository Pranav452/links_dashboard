// Domain types for LINKS branch productivity data.
// One Job row = one job line from a branch's monthly productivity sheet,
// stored as one ROW in the Neon table links_jobs (see lib/store.ts).

export interface Job {
  branch: string
  month: string // "YYYY-MM"
  department: string
  service_scope: string
  job_no: string
  job_date: string
  customer: string
  cha: string
  nomination_freehand: string
  nomination_agent: string
  carrier: string
  mbl_mawb: string
  hbl_type: string
  mode: string
  containers_count: number | null
  container_size: string
  packages: number | null
  gross_wt_kg: number | null
  chargeable_wt_kg: number | null
  origin: string
  pol: string
  pod: string
  final_destination: string
  buying_inr: number | null
  selling_inr: number | null
  remarks: string
}

// ---------------------------------------------------------------------------
// Coercion — turns a loosely-typed record (normalized JSON export, raw DB row)
// into a Job with every field present. Missing strings become "", missing
// numbers become null.
// ---------------------------------------------------------------------------

const STRING_FIELDS = [
  "branch", "month", "department", "service_scope", "job_no", "job_date", "customer", "cha",
  "nomination_freehand", "nomination_agent", "carrier", "mbl_mawb", "hbl_type", "mode",
  "container_size", "origin", "pol", "pod", "final_destination", "remarks",
] as const

const NUMBER_FIELDS = [
  "containers_count", "packages", "gross_wt_kg", "chargeable_wt_kg", "buying_inr", "selling_inr",
] as const

export function normalizeJob(input: unknown): Job {
  const r = (input ?? {}) as Record<string, unknown>
  const job = {} as Record<string, unknown>
  for (const k of STRING_FIELDS) {
    const v = r[k]
    job[k] = v === null || v === undefined ? "" : String(v).trim()
  }
  for (const k of NUMBER_FIELDS) {
    const v = r[k]
    if (v === null || v === undefined || v === "") {
      job[k] = null
      continue
    }
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim())
    job[k] = Number.isFinite(n) ? n : null
  }
  return job as unknown as Job
}

/** Gross profit for a job — null when either side of the money is missing. */
export function jobGpInr(job: Job): number | null {
  if (job.buying_inr === null && job.selling_inr === null) return null
  return (job.selling_inr ?? 0) - (job.buying_inr ?? 0)
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

export const MONTH_FULL_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/** "2026-04" → "Apr 2026" */
export function fmtMonth(month: string): string {
  const [y, m] = month.split("-")
  const idx = Number(m) - 1
  if (!y || idx < 0 || idx > 11) return month
  return `${MONTH_NAMES[idx]} ${y}`
}

/** "2026-04" → "April 2026" (filter-bar labels). */
export function fmtMonthLong(month: string): string {
  const [y, m] = month.split("-")
  const idx = Number(m) - 1
  if (!y || idx < 0 || idx > 11) return month
  return `${MONTH_FULL_NAMES[idx]} ${y}`
}

/** "2026-05" → "2026-04" (previous calendar month). */
export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number)
  if (!y || !m) return month
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  return `${py}-${String(pm).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// Branch slugs — "Delhi Air" ↔ "delhi-air" for /dashboard/branch/[slug]
// ---------------------------------------------------------------------------

export function branchSlug(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Reverse lookup against the branches present in the dataset. */
export function branchFromSlug(slug: string, branches: string[]): string | null {
  return branches.find((b) => branchSlug(b) === slug) ?? null
}

// ---------------------------------------------------------------------------
// Allowed vocabularies (template validation lists)
// ---------------------------------------------------------------------------

export const DEPARTMENTS = ["Air Import", "Air Export", "Sea Import", "Sea Export"] as const
export const SERVICE_SCOPES = ["Clearance Only", "Freight + Clearance", "Freight Only"] as const
export const MODES = ["Air", "FCL", "LCL"] as const
export const NOMINATION_TYPES = ["Nomination", "Freehand"] as const

/** Sorted unique values of a string field across jobs (blanks dropped). */
export function distinct(jobs: Job[], key: keyof Job): string[] {
  return [...new Set(jobs.map((j) => String(j[key] ?? "")).filter(Boolean))].sort()
}
