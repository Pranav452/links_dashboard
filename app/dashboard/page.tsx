import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Briefcase, Building2, Plane, Scale, Ship, Stamp } from "lucide-react"

import { BarChartCard } from "@/components/charts/bar-chart-card"
import { BarListCard } from "@/components/charts/bar-list-card"
import { DonutCard } from "@/components/charts/donut-card"
import { KpiCard } from "@/components/charts/kpi-card"
import { FilterBar } from "@/components/filter-bar"
import { SiteHeader } from "@/components/site-header"
import {
  airTonnes,
  branchComparison,
  countBy,
  filterJobs,
  fmtNum,
  fmtTonnes,
  isAir,
  isClearanceOnly,
  isSea,
  monthlyTrend,
  nominationSplit,
} from "@/lib/analytics"
import { branchFromSlug, branchSlug, fmtMonth, fmtMonthLong } from "@/lib/jobs"
import { DataErrorPage } from "@/components/data-error"
import { dataErrorMessage, loadJobs, loadJobsMeta, type JobsDataset, type JobsMeta } from "@/lib/store"

export const metadata: Metadata = {
  title: "Dashboard · LINKS Branch Analytics",
}

export const dynamic = "force-dynamic"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; branch?: string }>
}) {
  const sp = await searchParams

  // Axes come from SQL aggregates; rows come from a branch-scoped query, so a
  // branch filter never ships the whole table. The month filter stays in memory
  // because the trend chart needs every month of the active branch scope.
  let meta: JobsMeta
  let dataset: JobsDataset
  const branchSlugParam = sp.branch ?? null
  try {
    meta = await loadJobsMeta()
    const scopedBranch = branchSlugParam ? branchFromSlug(branchSlugParam, meta.branches) : null
    dataset = await loadJobs(scopedBranch ? { branch: scopedBranch } : {})
  } catch (err) {
    return <DataErrorPage crumb="HQ overview" message={dataErrorMessage(err)} />
  }

  const { jobs } = dataset
  const months = meta.months
  const branchNames = meta.branches
  const branchOptions = branchNames.map((name) => ({ name, slug: branchSlug(name) }))

  const month = sp.month && months.includes(sp.month) ? sp.month : null
  const branchName = branchSlugParam ? branchFromSlug(branchSlugParam, branchNames) : null
  const branchScoped = filterJobs(jobs, { month: null, branch: branchName })
  const filtered = filterJobs(jobs, { month, branch: branchName })

  const activeBranches = new Set(filtered.map((j) => j.branch)).size
  const seaJobs = filtered.filter(isSea).length
  const airJobs = filtered.filter(isAir).length
  const clearanceOnly = filtered.filter(isClearanceOnly).length
  const tonnes = airTonnes(filtered)

  const byBranch = countBy(filtered, (j) => j.branch)
  const deptMix = countBy(filtered, (j) => j.department)
  const scopeMix = countBy(filtered, (j) => j.service_scope)
  const nom = nominationSplit(filtered)
  const topPods = countBy(filtered, (j) => j.pod).slice(0, 10)
  const topCustomers = countBy(filtered, (j) => j.customer).slice(0, 10)
  const topChas = countBy(filtered, (j) => j.cha).slice(0, 10)

  // Trend always spans every month in the data (branch-scoped); the selected
  // month stays solid, the rest go faint when a month filter is active.
  const trend = monthlyTrend(branchScoped, months).map((t) => ({
    label: fmtMonth(t.month),
    value: t.count,
    muted: month !== null && t.month !== month,
    hint: `${fmtMonth(t.month)} · ${t.count} jobs`,
  }))

  const comparison = branchComparison(jobs, filtered, months, month)

  const scopeLabel = [branchName, month ? fmtMonthLong(month) : null].filter(Boolean).join(" · ")

  const thCls =
    "border-b border-foreground/10 px-3 py-2 text-left text-[10px] font-medium tracking-widest text-muted-foreground uppercase"
  const tdCls = "border-b border-foreground/[0.06] px-3 py-2.5 tabular-nums"

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {/* Title + filter bar */}
        <div className="mb-8 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-widest text-muted-foreground/70 uppercase">
            <span>LINKS</span>
            <span className="text-muted-foreground/30">/</span>
            <span>HQ overview</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Branch productivity
              {scopeLabel && <span className="text-emerald-600 dark:text-emerald-400"> · {scopeLabel}</span>}
            </h1>
            <div className="flex flex-wrap items-center gap-4">
              <FilterBar
                months={months}
                branches={branchOptions}
                month={month}
                branch={branchName ? branchSlug(branchName) : null}
              />
              <span className="text-xs text-muted-foreground">
                {meta.total === 0
                  ? "No data loaded — upload a branch template from the admin panel"
                  : `Source: ${dataset.source}${dataset.updatedAt ? ` · ${new Date(dataset.updatedAt).toLocaleDateString("en-IN")}` : ""}`}
              </span>
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Total jobs" value={fmtNum(filtered.length)} icon={<Briefcase />} accent sub={scopeLabel || "All branches · all months"} />
          <KpiCard label="Active branches" value={String(activeBranches)} icon={<Building2 />} sub={`of ${branchNames.length} reporting`} />
          <KpiCard label="Sea jobs" value={fmtNum(seaJobs)} icon={<Ship />} sub="Sea Import + Sea Export" />
          <KpiCard label="Air jobs" value={fmtNum(airJobs)} icon={<Plane />} sub="Air Import + Air Export" />
          <KpiCard label="Clearance only" value={fmtNum(clearanceOnly)} icon={<Stamp />} sub="Service scope = Clearance Only" />
          <KpiCard label="Air tonnage" value={fmtTonnes(tonnes)} unit="t" icon={<Scale />} sub="Gross weight of Air dept jobs" />
        </div>

        {/* Monthly trend + nomination split */}
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <BarChartCard
            className="xl:col-span-2"
            title="Monthly trend"
            subtitle={branchName ? `Jobs per month · ${branchName}` : "Jobs per month · all branches"}
            data={trend}
            unit="jobs"
            height={150}
          />
          <DonutCard
            title="Nomination vs Freehand"
            subtitle={nom.unknown > 0 ? `${fmtNum(nom.unknown)} rows unknown` : "All rows classified"}
            data={[
              { name: "Nomination", value: nom.nomination },
              { name: "Freehand", value: nom.freehand },
            ].filter((d) => d.value > 0)}
            unit="jobs"
            centerLabel="known rows"
          />
        </div>

        {/* Branch + mix charts */}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <BarListCard title="Jobs by branch" subtitle="sorted by volume" data={byBranch} unit="jobs" live />
          <DonutCard title="Department mix" subtitle="by jobs" data={deptMix} unit="jobs" centerLabel="jobs" />
          <DonutCard title="Service scope mix" subtitle="by jobs" data={scopeMix} unit="jobs" centerLabel="jobs" />
        </div>

        {/* Top lists */}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <BarListCard title="Top destinations (POD)" subtitle="top 10 by jobs" data={topPods} unit="jobs" />
          <BarListCard title="Top customers" subtitle="top 10 by jobs" data={topCustomers} unit="jobs" />
          <BarListCard title="Top CHAs" subtitle="top 10 by jobs" data={topChas} unit="jobs" />
        </div>

        {/* Branch comparison table */}
        <div className="mt-4 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Branch comparison
            </span>
            <span className="text-xs text-muted-foreground/60">
              {comparison[0]?.refMonth
                ? `MoM delta = ${fmtMonth(comparison[0].refMonth)} vs previous month`
                : "MoM delta unavailable"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className={thCls}>Branch</th>
                  <th className={`${thCls} text-right`}>Jobs</th>
                  <th className={`${thCls} text-right`}>Sea / Air</th>
                  <th className={`${thCls} text-right`}>Clearance only</th>
                  <th className={`${thCls} text-right`}>Nomination %</th>
                  <th className={`${thCls} text-right`}>Air weight</th>
                  <th className={`${thCls} text-right`}>MoM Δ</th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.branch} className="transition-colors hover:bg-foreground/[0.03]">
                    <td className={`${tdCls} font-medium`}>{row.branch}</td>
                    <td className={`${tdCls} text-right font-semibold`}>{fmtNum(row.jobs)}</td>
                    <td className={`${tdCls} text-right text-muted-foreground`}>
                      {fmtNum(row.sea)} / {fmtNum(row.air)}
                    </td>
                    <td className={`${tdCls} text-right`}>{fmtNum(row.clearanceOnly)}</td>
                    <td className={`${tdCls} text-right`}>{row.nomPct !== null ? `${row.nomPct}%` : "—"}</td>
                    <td className={`${tdCls} text-right`}>
                      {row.airKg > 0 ? `${fmtTonnes(row.airKg / 1000)} t` : "—"}
                    </td>
                    <td
                      className={`${tdCls} text-right font-medium ${
                        row.delta === null
                          ? "text-muted-foreground/50"
                          : row.delta > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : row.delta < 0
                              ? "text-red-500 dark:text-red-400"
                              : "text-muted-foreground"
                      }`}
                    >
                      {row.delta === null ? "—" : row.delta > 0 ? `+${row.delta}` : String(row.delta)}
                    </td>
                    <td className={`${tdCls} text-right`}>
                      <Link
                        href={
                          month
                            ? `/dashboard/branch/${branchSlug(row.branch)}?month=${encodeURIComponent(month)}`
                            : `/dashboard/branch/${branchSlug(row.branch)}`
                        }
                        className="inline-flex items-center gap-1 text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400"
                      >
                        View
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] text-muted-foreground/50">
          LINKS HQ branch-productivity dashboard · internal use only
        </p>
      </main>
    </div>
  )
}
