"use client"

import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"

import { fmtMonthLong } from "@/lib/jobs"
import { cn } from "@/lib/utils"

export interface BranchOption {
  name: string
  slug: string
}

// Shared month + branch filter. Writes ?month= (and ?branch= slug) to the URL;
// server components recompute everything for the selection (vipar's
// period-filter pattern). On /dashboard/branch/[slug] pages the branch select
// navigates between branch pages instead of setting a query param.
export function FilterBar({
  months,
  branches,
  month,
  branch,
  className,
}: {
  months: string[] // "YYYY-MM", sorted asc
  branches: BranchOption[]
  month: string | null
  branch: string | null // slug
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const onBranchPage = pathname.startsWith("/dashboard/branch/")

  const apply = (m: string | null, b: string | null) => {
    const params = new URLSearchParams()
    if (m !== null) params.set("month", m)
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
        aria-label="Month"
        className={selectCls}
        value={month ?? "all"}
        onChange={(e) => apply(e.target.value === "all" ? null : e.target.value, branch)}
      >
        <option value="all" style={optionStyle}>
          All months
        </option>
        {months.map((m) => (
          <option key={m} value={m} style={optionStyle}>
            {fmtMonthLong(m)}
          </option>
        ))}
      </select>
      <select
        aria-label="Branch"
        className={selectCls}
        value={branch ?? "all"}
        onChange={(e) => apply(month, e.target.value === "all" ? null : e.target.value)}
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
      {(month !== null || branch !== null) && (
        <button
          onClick={() => apply(null, null)}
          className="rounded-full border border-emerald-500/30 px-2.5 py-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase transition-colors hover:bg-emerald-500/10"
        >
          Clear
        </button>
      )}
    </div>
  )
}
