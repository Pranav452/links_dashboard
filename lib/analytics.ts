// Aggregation helpers shared by the dashboard, branch and finance pages.
// Everything works on plain Job[] slices — pages filter first, then aggregate.

import { jobGpInr, prevMonth, type Job } from "./jobs"

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export interface JobFilter {
  month: string | null // "YYYY-MM"
  branch: string | null // canonical branch name
}

export function filterJobs(jobs: Job[], filter: JobFilter): Job[] {
  return jobs.filter(
    (j) =>
      (filter.month === null || j.month === filter.month) &&
      (filter.branch === null || j.branch === filter.branch),
  )
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

export const isAir = (j: Job) => j.department.startsWith("Air")
export const isSea = (j: Job) => j.department.startsWith("Sea")
export const isClearanceOnly = (j: Job) => j.service_scope === "Clearance Only"

// ---------------------------------------------------------------------------
// Aggregations
// ---------------------------------------------------------------------------

export interface NamedCount {
  name: string
  value: number
}

/** Count jobs by a derived key, blanks dropped, sorted desc. */
export function countBy(jobs: Job[], key: (j: Job) => string): NamedCount[] {
  const map = new Map<string, number>()
  for (const j of jobs) {
    const k = key(j).trim()
    if (!k) continue
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
}

/** Total gross weight of Air-department jobs, in tonnes. */
export function airTonnes(jobs: Job[]): number {
  const kg = jobs.filter(isAir).reduce((acc, j) => acc + (j.gross_wt_kg ?? 0), 0)
  return kg / 1000
}

/**
 * Air-weight reporting coverage for a scope: how many Air jobs actually carry a
 * gross weight. Several branches never record weight at all — a plain 0.0 t
 * reads as a broken metric, so callers show "not reported" when reported === 0.
 */
export function airWeightCoverage(jobs: Job[]): { air: number; reported: number } {
  const air = jobs.filter(isAir)
  return {
    air: air.length,
    reported: air.filter((j) => j.gross_wt_kg !== null && j.gross_wt_kg > 0).length,
  }
}

/** Jobs per month across the given month axis (respects any pre-filtering). */
export function monthlyTrend(jobs: Job[], months: string[]): { month: string; count: number }[] {
  const map = new Map<string, number>()
  for (const j of jobs) map.set(j.month, (map.get(j.month) ?? 0) + 1)
  return months.map((m) => ({ month: m, count: map.get(m) ?? 0 }))
}

/** Nomination vs Freehand split; unknown = rows where the field is blank. */
export function nominationSplit(jobs: Job[]): { nomination: number; freehand: number; unknown: number } {
  let nomination = 0
  let freehand = 0
  let unknown = 0
  for (const j of jobs) {
    const v = j.nomination_freehand.trim().toLowerCase()
    if (v === "nomination") nomination++
    else if (v === "freehand") freehand++
    else unknown++
  }
  return { nomination, freehand, unknown }
}

// ---------------------------------------------------------------------------
// Branch comparison (dashboard table)
// ---------------------------------------------------------------------------

export interface BranchComparisonRow {
  branch: string
  jobs: number
  sea: number
  air: number
  clearanceOnly: number
  /** % Nomination among rows where the field is known; null when none known. */
  nomPct: number | null
  airKg: number
  /** Jobs in refMonth minus jobs in the previous month; null when no basis. */
  delta: number | null
  refMonth: string | null
}

/**
 * Per-branch stats. `scoped` is the month-filtered slice used for the counts;
 * `all` is the month-unfiltered slice (same branch scope) used for MoM delta.
 * refMonth = selected month, else the latest month present in the data.
 */
export function branchComparison(
  all: Job[],
  scoped: Job[],
  months: string[],
  selectedMonth: string | null,
): BranchComparisonRow[] {
  const refMonth = selectedMonth ?? (months.length > 0 ? months[months.length - 1] : null)
  const prev = refMonth ? prevMonth(refMonth) : null
  const hasPrev = prev !== null && months.includes(prev)

  const branches = [...new Set(all.map((j) => j.branch))].sort()
  return branches.map((branch) => {
    const rows = scoped.filter((j) => j.branch === branch)
    const branchAll = all.filter((j) => j.branch === branch)
    const known = rows.filter((j) => {
      const v = j.nomination_freehand.trim().toLowerCase()
      return v === "nomination" || v === "freehand"
    })
    const nom = known.filter((j) => j.nomination_freehand.trim().toLowerCase() === "nomination").length
    const refCount = refMonth ? branchAll.filter((j) => j.month === refMonth).length : 0
    const prevCount = hasPrev ? branchAll.filter((j) => j.month === prev).length : 0
    return {
      branch,
      jobs: rows.length,
      sea: rows.filter(isSea).length,
      air: rows.filter(isAir).length,
      clearanceOnly: rows.filter(isClearanceOnly).length,
      nomPct: known.length > 0 ? Math.round((nom / known.length) * 100) : null,
      airKg: rows.filter(isAir).reduce((acc, j) => acc + (j.gross_wt_kg ?? 0), 0),
      delta: refMonth !== null && hasPrev ? refCount - prevCount : null,
      refMonth,
    }
  })
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export const fmtNum = (n: number) => n.toLocaleString("en-IN")

export const fmtINR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

export const fmtTonnes = (t: number) =>
  t.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const fmtKg = (kg: number) => `${Math.round(kg).toLocaleString("en-IN")} kg`
