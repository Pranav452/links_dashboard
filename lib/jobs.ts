// Domain types for LINKS branch productivity data.
// One Job row = one job line from a branch's monthly productivity sheet,
// normalized upstream into normalized-jobs.json / the links_jobs_versions table.

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

/** Gross profit for a job — null when either side of the money is missing. */
export function jobGpInr(job: Job): number | null {
  if (job.buying_inr === null && job.selling_inr === null) return null
  return (job.selling_inr ?? 0) - (job.buying_inr ?? 0)
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

/** "2026-04" → "Apr 2026" */
export function fmtMonth(month: string): string {
  const [y, m] = month.split("-")
  const idx = Number(m) - 1
  if (!y || idx < 0 || idx > 11) return month
  return `${MONTH_NAMES[idx]} ${y}`
}

/** Sorted unique values of a string field across jobs (blanks dropped). */
export function distinct(jobs: Job[], key: keyof Job): string[] {
  return [...new Set(jobs.map((j) => String(j[key] ?? "")).filter(Boolean))].sort()
}
