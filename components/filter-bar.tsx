"use client"

import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"

import type { PeriodOption } from "@/lib/period"
import { cn } from "@/lib/utils"

export interface BranchOption {
  name: string
  slug: string
}

// Shared period + branch filter. Writes ?month= (and ?branch= slug) to the URL;
// server components recompute everything for the selection (vipar's
// period-filter pattern). ?month= carries a period: "fy-2026", "all" or a single
// "YYYY-MM"; no param = the default period (latest fiscal year), so the Clear
// button returns to it. On /dashboard/branch/[slug] pages the branch select
// navigates between branch pages instead of setting a query param.
export function FilterBar({
  fiscalYears,
  months,
  branches,
  period,
  defaultPeriod,
  branch,
  className,
}: {
  fiscalYears: PeriodOption[] // newest first
  months: PeriodOption[] // sorted asc
  branches: BranchOption[]
  period: string // active ?month= value (periodParam)
  defaultPeriod: string // periodParam of the default period
  branch: string | null // slug
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const onBranchPage = pathname.startsWith("/dashboard/branch/")

  const apply = (p: string, b: string | null) => {
    const params = new URLSearchParams()
    if (p !== defaultPeriod) params.set("month", p)
    let target = pathname
    if (onBranchPage) {
      target = b !== null ? `/dashboard/branch/${b}` : "/dashboard"
    } else if (b !== null) {
      params.set("branch", b)
    }
    const qs = params.toString()
    startTransition(() => router.replace(qs ? `${target}?${qs}` : target, { scroll: false }))
  }

  const selectCls =
    "h-8 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 text-xs focus:border-emerald-500/60 focus:outline-none"
  // Native <option> popups inherit the page foreground on some platforms,
  // turning white-on-white in dark mode — force readable colors explicitly.
  const optionStyle = { color: "#111", backgroundColor: "#fff" } as const

  return (
    <div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-60", className)}>
      <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Filter</span>
      <select
        aria-label="Period"
        className={selectCls}
        value={period}
        onChange={(e) => apply(e.target.value, branch)}
      >
        {fiscalYears.length > 0 && (
          <optgroup label="Fiscal year" style={optionStyle}>
            {fiscalYears.map((o) => (
              <option key={o.value} value={o.value} style={optionStyle}>
                {o.label}
              </option>
            ))}
          </optgroup>
        )}
        <option value="all" style={optionStyle}>
          All months
        </option>
        <optgroup label="Month" style={optionStyle}>
          {months.map((o) => (
            <option key={o.value} value={o.value} style={optionStyle}>
              {o.label}
            </option>
          ))}
        </optgroup>
      </select>
      <select
        aria-label="Branch"
        className={selectCls}
        value={branch ?? "all"}
        onChange={(e) => apply(period, e.target.value === "all" ? null : e.target.value)}
      >
        <option value="all" style={optionStyle}>
          All branches
        </option>
        {branches.map((b) => (
          <option key={b.slug} value={b.slug} style={optionStyle}>
            {b.name}
          </option>
        ))}
      </select>
      {(period !== defaultPeriod || branch !== null) && (
        <button
          onClick={() => apply(defaultPeriod, null)}
          className="rounded-full border border-emerald-500/30 px-2.5 py-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase transition-colors hover:bg-emerald-500/10"
        >
          Clear
        </button>
      )}
    </div>
  )
}
