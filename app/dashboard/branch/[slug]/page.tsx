import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Briefcase, Plane, Scale, Ship, Stamp, Users } from "lucide-react"

import { BarChartCard } from "@/components/charts/bar-chart-card"
import { BarListCard } from "@/components/charts/bar-list-card"
import { DonutCard } from "@/components/charts/donut-card"
import { KpiCard } from "@/components/charts/kpi-card"
import { FilterBar } from "@/components/filter-bar"
import { JobsTable } from "@/components/jobs-table"
import { SiteHeader } from "@/components/site-header"
import {
  airTonnes,
  airWeightCoverage,
  countBy,
  filterJobs,
  fmtNum,
  fmtTonnes,
  isAir,
  isClearanceOnly,
  isSea,
  monthlyTrend,
} from "@/lib/analytics"
import { branchFromSlug, branchSlug, fmtMonth, type Job } from "@/lib/jobs"
import { defaultPeriod, inPeriod, periodLabel, periodOptions, periodParam, resolvePeriod } from "@/lib/period"
import { DataErrorPage } from "@/components/data-error"
import { dataErrorMessage, loadJobs, loadJobsMeta, type JobsMeta } from "@/lib/store"

export const dynamic = "force-dynamic"

const TABLE_CAP = 200

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return { title: `${slug} · LINKS Branch Analytics` }
}

export default async function BranchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])

  // Only this branch's rows are fetched (SQL-side filter). The period filter is
  // applied in memory because the trend chart spans every month of the branch.
  let meta: JobsMeta
  let branchJobs: Job[]
  let resolved: string | null = null
  try {
    meta = await loadJobsMeta()
    resolved = branchFromSlug(slug, meta.branches)
    branchJobs = resolved ? (await loadJobs({ branch: resolved })).jobs : []
  } catch (err) {
    return <DataErrorPage crumb="Branch" message={dataErrorMessage(err)} />
  }
  if (!resolved) notFound()

  const months = meta.months
  const branch = resolved
  const period = resolvePeriod(sp.month, months)
  const options = periodOptions(months)
  const filtered = filterJobs(branchJobs, { period, branch: null })
  const reportedMonths = new Set(filtered.map((j) => j.month)).size

  const customers = new Set(filtered.map((j) => j.customer.trim()).filter(Boolean)).size
  const seaJobs = filtered.filter(isSea).length
  const airJobs = filtered.filter(isAir).length
  const clearanceOnly = filtered.filter(isClearanceOnly).length
  const tonnes = airTonnes(filtered)
  const wtCoverage = airWeightCoverage(filtered)

  const deptMix = countBy(filtered, (j) => j.department)
  const scopeMix = countBy(filtered, (j) => j.service_scope)
  const topCustomers = countBy(filtered, (j) => j.customer).slice(0, 10)
  const topChas = countBy(filtered, (j) => j.cha).slice(0, 10)
  const topPods = countBy(filtered, (j) => j.pod).slice(0, 10)

  const trend = monthlyTrend(branchJobs, months).map((t) => ({
    label: fmtMonth(t.month),
    value: t.count,
    muted: !inPeriod(period, t.month),
    hint: `${fmtMonth(t.month)} · ${t.count} jobs`,
  }))

  // Latest first, capped for the client table.
  const tableJobs = [...filtered]
    .sort((a, b) => (b.job_date || b.month).localeCompare(a.job_date || a.month))
    .slice(0, TABLE_CAP)

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {/* Title + filter bar */}
        <div className="mb-8 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-widest text-muted-foreground/70 uppercase">
            <span>LINKS</span>
            <span className="text-muted-foreground/30">/</span>
            <span>Branch</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {branch}
              {period.kind !== "all" && (
                <span className="text-emerald-600 dark:text-emerald-400"> · {periodLabel(period)}</span>
              )}
            </h1>
            <FilterBar
              fiscalYears={options.fiscalYears}
              months={options.months}
              branches={meta.branches.map((name) => ({ name, slug: branchSlug(name) }))}
              period={periodParam(period)}
              defaultPeriod={periodParam(defaultPeriod(months))}
              branch={slug}
            />
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Total jobs" value={fmtNum(filtered.length)} icon={<Briefcase />} accent sub={
              period.kind === "month" || reportedMonths === 0
                ? periodLabel(period)
                : `${periodLabel(period)} · ${(filtered.length / reportedMonths).toLocaleString("en-IN", { maximumFractionDigits: 1 })} / month over ${reportedMonths} mo`
            } />
          <KpiCard label="Customers" value={fmtNum(customers)} icon={<Users />} sub="Distinct shippers / consignees" />
          <KpiCard label="Sea jobs" value={fmtNum(seaJobs)} icon={<Ship />} sub="Sea Import + Sea Export" />
          <KpiCard label="Air jobs" value={fmtNum(airJobs)} icon={<Plane />} sub="Air Import + Air Export" />
          <KpiCard label="Clearance only" value={fmtNum(clearanceOnly)} icon={<Stamp />} sub="Service scope = Clearance Only" />
          <KpiCard
            label="Air tonnage"
            value={wtCoverage.reported > 0 ? fmtTonnes(tonnes) : "—"}
            unit={wtCoverage.reported > 0 ? "t" : undefined}
            icon={<Scale />}
            sub={
              wtCoverage.air === 0
                ? "No air jobs in this scope"
                : wtCoverage.reported === 0
                  ? `Weight not reported on ${fmtNum(wtCoverage.air)} air jobs`
                  : `Gross weight · ${fmtNum(wtCoverage.reported)} of ${fmtNum(wtCoverage.air)} air jobs report it`
            }
          />
        </div>

        {/* Mix donuts */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <DonutCard title="Department mix" subtitle="by jobs" data={deptMix} unit="jobs" centerLabel="jobs" />
          <DonutCard title="Service scope mix" subtitle="by jobs" data={scopeMix} unit="jobs" centerLabel="jobs" />
        </div>

        {/* Monthly trend */}
        <div className="mt-4">
          <BarChartCard
            title="Monthly trend"
            subtitle={`Jobs per month · ${branch}`}
            data={trend}
            unit="jobs"
            height={150}
          />
        </div>

        {/* Top lists */}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <BarListCard title="Top customers" subtitle="top 10 by jobs" data={topCustomers} unit="jobs" live />
          <BarListCard title="Top CHAs" subtitle="top 10 by jobs" data={topChas} unit="jobs" />
          <BarListCard title="Top destinations (POD)" subtitle="top 10 by jobs" data={topPods} unit="jobs" />
        </div>

        {/* Jobs table */}
        <div className="mt-4">
          <JobsTable jobs={tableJobs} totalCount={filtered.length} />
        </div>

        <p className="mt-8 text-center text-[11px] text-muted-foreground/50">
          {branch} branch productivity · LINKS HQ internal
        </p>
      </main>
    </div>
  )
}
