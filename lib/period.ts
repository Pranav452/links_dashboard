// Reporting period selected via ?month= on every dashboard page.
//
//   (absent)   -> the latest Indian fiscal year present in the data (default)
//   fy-2026    -> FY 2026-27 = 2026-04 .. 2027-03
//   all        -> every month
//   2026-08    -> one calendar month
//
// The default is a fiscal year rather than "All months" because branches have
// very unequal history (Bangalore reaches back to 2016, most branches start in
// Apr 2026) — an all-time comparison is not like-for-like.

import { fmtMonthLong } from "./jobs"

export type Period =
  | { kind: "all" }
  | { kind: "month"; month: string }
  | { kind: "fy"; startYear: number; from: string; to: string }

export const ALL_PARAM = "all"

/** Indian fiscal year (Apr–Mar) start year of a "YYYY-MM" month. */
export function fiscalYearOf(month: string): number | null {
  const [y, m] = month.split("-").map(Number)
  if (!y || !m) return null
  return m >= 4 ? y : y - 1
}

export function fyPeriod(startYear: number): Period {
  return { kind: "fy", startYear, from: `${startYear}-04`, to: `${startYear + 1}-03` }
}

export function fyLabel(startYear: number): string {
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`
}

/** Fiscal years present in the data, newest first. */
export function fiscalYears(months: string[]): number[] {
  const years = new Set<number>()
  for (const m of months) {
    const fy = fiscalYearOf(m)
    if (fy !== null) years.add(fy)
  }
  return [...years].sort((a, b) => b - a)
}

export function defaultPeriod(months: string[]): Period {
  const latest = fiscalYears(months)[0]
  return latest === undefined ? { kind: "all" } : fyPeriod(latest)
}

/** Parses ?month=, falling back to the default period for absent/unknown values. */
export function resolvePeriod(param: string | undefined | null, months: string[]): Period {
  if (param === ALL_PARAM) return { kind: "all" }
  if (param) {
    const fy = /^fy-(\d{4})$/.exec(param)
    if (fy && fiscalYears(months).includes(Number(fy[1]))) return fyPeriod(Number(fy[1]))
    if (months.includes(param)) return { kind: "month", month: param }
  }
  return defaultPeriod(months)
}

/** The ?month= value that selects this period. */
export function periodParam(p: Period): string {
  if (p.kind === "all") return ALL_PARAM
  if (p.kind === "month") return p.month
  return `fy-${p.startYear}`
}

export function periodLabel(p: Period): string {
  if (p.kind === "all") return "All months"
  if (p.kind === "month") return fmtMonthLong(p.month)
  return fyLabel(p.startYear)
}

export function inPeriod(p: Period, month: string): boolean {
  if (p.kind === "all") return true
  if (p.kind === "month") return month === p.month
  return month >= p.from && month <= p.to
}

/** Months of the data axis that fall inside the period. */
export function periodMonths(p: Period, months: string[]): string[] {
  return months.filter((m) => inPeriod(p, m))
}

/** SQL-side filter for lib/store loadJobs. */
export function periodJobsFilter(p: Period): { month?: string; monthFrom?: string; monthTo?: string } {
  if (p.kind === "month") return { month: p.month }
  if (p.kind === "fy") return { monthFrom: p.from, monthTo: p.to }
  return {}
}

export interface PeriodOption {
  value: string
  label: string
}

/** Filter-bar options: fiscal years (newest first), then single months. */
export function periodOptions(months: string[]): { fiscalYears: PeriodOption[]; months: PeriodOption[] } {
  return {
    fiscalYears: fiscalYears(months).map((y) => ({ value: `fy-${y}`, label: fyLabel(y) })),
    months: months.map((m) => ({ value: m, label: fmtMonthLong(m) })),
  }
}
