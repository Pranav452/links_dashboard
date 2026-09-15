import type { Metadata } from "next"
import { BadgePercent, IndianRupee, PiggyBank, Sparkles, TrendingUp } from "lucide-react"

import { KpiCard } from "@/components/charts/kpi-card"
import { FilterBar } from "@/components/filter-bar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { fmtINR, fmtNum } from "@/lib/analytics"
import { getSession } from "@/lib/auth"
import { DataErrorPage } from "@/components/data-error"
import { branchFromSlug, branchSlug, fmtMonth, jobGpInr, type Job } from "@/lib/jobs"
import {
  defaultPeriod,
  periodJobsFilter,
  periodLabel,
  periodMonths,
  periodOptions,
  periodParam,
  resolvePeriod,
  type Period,
} from "@/lib/period"
import {
  dataErrorMessage,
  loadExpenses,
  loadJobs,
  loadJobsMeta,
  type ExpensesMap,
  type JobsMeta,
} from "@/lib/store"
import { cn } from "@/lib/utils"
import { saveExpensesGrid } from "./actions"

export const metadata: Metadata = {
  title: "Finance · LINKS Branch Analytics",
}

export const dynamic = "force-dynamic"

interface FinanceRow {
  branch: string
  jobs: number
  withFin: number
  selling: number
  buying: number
  gp: number
  expenses: number
  net: number
  margin: number | null // GP / selling
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; branch?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  const isAdmin = session?.role === "admin"

  // Finance needs no cross-month trend, so BOTH filters are pushed into SQL —
  // a filtered view only ever fetches the rows it renders.
  let meta: JobsMeta
  let expensesMap: ExpensesMap
  let filtered: Job[]
  let period: Period = { kind: "all" }
  let branchName: string | null = null
  try {
    meta = await loadJobsMeta()
    period = resolvePeriod(sp.month, meta.months)
    branchName = sp.branch ? branchFromSlug(sp.branch, meta.branches) : null
    const [dataset, expenses] = await Promise.all([
      loadJobs({ ...(branchName ? { branch: branchName } : {}), ...periodJobsFilter(period) }),
      loadExpenses(),
    ])
    filtered = dataset.jobs
    expensesMap = expenses
  } catch (err) {
    return <DataErrorPage crumb="Finance" message={dataErrorMessage(err)} />
  }

  const months = meta.months
  const branchNames = meta.branches

  const expensesFor = (branch: string): number => {
    const row = expensesMap[branch] ?? {}
    return periodMonths(period, months).reduce((acc, m) => acc + (row[m] ?? 0), 0)
  }

  const visibleBranches = branchName ? [branchName] : branchNames
  const rows: FinanceRow[] = visibleBranches.map((branch) => {
    const bj = filtered.filter((j) => j.branch === branch)
    const withFinRows = bj.filter((j) => j.buying_inr !== null || j.selling_inr !== null)
    const selling = bj.reduce((acc, j) => acc + (j.selling_inr ?? 0), 0)
    const buying = bj.reduce((acc, j) => acc + (j.buying_inr ?? 0), 0)
    const gp = bj.reduce((acc, j) => acc + (jobGpInr(j) ?? 0), 0)
    const expenses = expensesFor(branch)
    return {
      branch,
      jobs: bj.length,
      withFin: withFinRows.length,
      selling,
      buying,
      gp,
      expenses,
      net: gp - expenses,
      margin: selling > 0 ? gp / selling : null,
    }
  })

  const totals = rows.reduce(
    (acc, r) => ({
      jobs: acc.jobs + r.jobs,
      withFin: acc.withFin + r.withFin,
      selling: acc.selling + r.selling,
      buying: acc.buying + r.buying,
      gp: acc.gp + r.gp,
      expenses: acc.expenses + r.expenses,
      net: acc.net + r.net,
    }),
    { jobs: 0, withFin: 0, selling: 0, buying: 0, gp: 0, expenses: 0, net: 0 },
  )
  const coverage = totals.jobs > 0 ? Math.round((totals.withFin / totals.jobs) * 100) : 0
  const hasFinancials = totals.withFin > 0

  const scopeLabel = [branchName, period.kind === "all" ? null : periodLabel(period)].filter(Boolean).join(" · ")
  const options = periodOptions(months)

  const thCls =
    "border-b border-foreground/10 px-3 py-2 text-left text-[10px] font-medium tracking-widest text-muted-foreground uppercase"
  const tdCls = "border-b border-foreground/[0.06] px-3 py-2.5 tabular-nums"
  const mutedMoney = hasFinancials ? "" : "text-muted-foreground/40"

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {/* Title + filter bar */}
        <div className="mb-8 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-widest text-muted-foreground/70 uppercase">
            <span>LINKS</span>
            <span className="text-muted-foreground/30">/</span>
            <span>Finance</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Branch financials
              {scopeLabel && <span className="text-emerald-600 dark:text-emerald-400"> · {scopeLabel}</span>}
            </h1>
            <FilterBar
              fiscalYears={options.fiscalYears}
              months={options.months}
              branches={branchNames.map((name) => ({ name, slug: branchSlug(name) }))}
              period={periodParam(period)}
              defaultPeriod={periodParam(defaultPeriod(months))}
              branch={branchName ? branchSlug(branchName) : null}
            />
          </div>
        </div>

        {/* Coverage banner while financials are absent */}
        {!hasFinancials && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Buying / Selling arrive with the new template</span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                None of the {fmtNum(totals.jobs)} jobs in scope carry financials yet — coverage is 0%. As soon as
                branches upload the new productivity template with Buying (INR) and Selling (INR) filled, this page
                lights up automatically: per-branch GP, net after fixed expenses and margin badges. Fixed expenses can
                already be maintained below.
              </span>
            </div>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard
            label="Selling"
            value={fmtINR(totals.selling)}
            icon={<IndianRupee />}
            sub={hasFinancials ? "Sum of reported selling" : "No financials reported yet"}
            accent={hasFinancials}
          />
          <KpiCard
            label="Buying"
            value={fmtINR(totals.buying)}
            icon={<PiggyBank />}
            sub={hasFinancials ? "Sum of reported buying" : "No financials reported yet"}
          />
          <KpiCard
            label="Gross profit"
            value={fmtINR(totals.gp)}
            icon={<TrendingUp />}
            sub="Selling − buying, where reported"
          />
          <KpiCard
            label="Coverage"
            value={`${coverage}%`}
            icon={<BadgePercent />}
            sub={`${fmtNum(totals.withFin)} of ${fmtNum(totals.jobs)} jobs carry financials`}
          />
        </div>

        {/* Per-branch finance table */}
        <div className="mt-4 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Per-branch financials
            </span>
            <span className="text-xs text-muted-foreground/60">
              Net = gross profit − fixed expenses ({periodLabel(period)})
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className={thCls}>Branch</th>
                  <th className={`${thCls} text-right`}>Jobs</th>
                  <th className={`${thCls} text-right`}>Coverage</th>
                  <th className={`${thCls} text-right`}>Selling</th>
                  <th className={`${thCls} text-right`}>Buying</th>
                  <th className={`${thCls} text-right`}>Gross profit</th>
                  <th className={`${thCls} text-right`}>Fixed expenses</th>
                  <th className={`${thCls} text-right`}>Net</th>
                  <th className={`${thCls} text-right`}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const rowCoverage = r.jobs > 0 ? Math.round((r.withFin / r.jobs) * 100) : 0
                  return (
                    <tr key={r.branch} className="transition-colors hover:bg-foreground/[0.03]">
                      <td className={`${tdCls} font-medium`}>{r.branch}</td>
                      <td className={`${tdCls} text-right`}>{fmtNum(r.jobs)}</td>
                      <td className={`${tdCls} text-right`}>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            rowCoverage > 0
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-foreground/[0.06] text-muted-foreground",
                          )}
                        >
                          {rowCoverage}%
                        </span>
                      </td>
                      <td className={`${tdCls} text-right ${mutedMoney}`}>{fmtINR(r.selling)}</td>
                      <td className={`${tdCls} text-right ${mutedMoney}`}>{fmtINR(r.buying)}</td>
                      <td className={`${tdCls} text-right font-medium ${mutedMoney}`}>{fmtINR(r.gp)}</td>
                      <td className={`${tdCls} text-right`}>{fmtINR(r.expenses)}</td>
                      <td
                        className={cn(
                          `${tdCls} text-right font-semibold`,
                          r.net > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : r.net < 0
                              ? "text-red-500 dark:text-red-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {fmtINR(r.net)}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        {r.margin !== null ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              r.margin >= 0
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-red-500/10 text-red-500 dark:text-red-400",
                            )}
                          >
                            {Math.round(r.margin * 100)}% GP
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-foreground/[0.02] font-semibold">
                  <td className={tdCls}>Total</td>
                  <td className={`${tdCls} text-right`}>{fmtNum(totals.jobs)}</td>
                  <td className={`${tdCls} text-right`}>{coverage}%</td>
                  <td className={`${tdCls} text-right`}>{fmtINR(totals.selling)}</td>
                  <td className={`${tdCls} text-right`}>{fmtINR(totals.buying)}</td>
                  <td className={`${tdCls} text-right`}>{fmtINR(totals.gp)}</td>
                  <td className={`${tdCls} text-right`}>{fmtINR(totals.expenses)}</td>
                  <td
                    className={cn(
                      `${tdCls} text-right`,
                      totals.net > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : totals.net < 0
                          ? "text-red-500 dark:text-red-400"
                          : "",
                    )}
                  >
                    {fmtINR(totals.net)}
                  </td>
                  <td className={`${tdCls} text-right text-muted-foreground/40`}>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Fixed expenses grid */}
        <form action={saveExpensesGrid} className="mt-4 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Fixed expenses (INR / branch / month)
              </span>
              <span className="text-xs text-muted-foreground/60">
                {isAdmin
                  ? "Edit any cell and save — blanks clear the entry."
                  : "Maintained by admin · read-only view"}
              </span>
            </div>
            {isAdmin && (
              <Button type="submit" size="sm" className="h-8 rounded-full px-4 text-xs">
                Save expenses
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className={thCls}>Branch</th>
                  {months.map((m) => (
                    <th key={m} className={`${thCls} text-right`}>
                      {fmtMonth(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branchNames.map((branch) => (
                  <tr key={branch} className="transition-colors hover:bg-foreground/[0.03]">
                    <td className={`${tdCls} font-medium`}>{branch}</td>
                    {months.map((m) => {
                      const value = expensesMap[branch]?.[m]
                      return (
                        <td key={m} className={`${tdCls} text-right`}>
                          {isAdmin ? (
                            <input
                              name={`exp|${branch}|${m}`}
                              defaultValue={value !== undefined ? String(value) : ""}
                              inputMode="numeric"
                              placeholder="—"
                              className="w-28 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-xs tabular-nums transition-colors focus:border-emerald-500/50 focus:bg-background focus:outline-none hover:border-foreground/10"
                            />
                          ) : (
                            <span className={value === undefined ? "text-muted-foreground/40" : ""}>
                              {value !== undefined ? fmtINR(value) : "—"}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>

        <p className="mt-8 text-center text-[11px] text-muted-foreground/50">
          Financial coverage grows as branches adopt the new template · LINKS HQ internal
        </p>
      </main>
    </div>
  )
}
