"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { fmtMonth, type Job } from "@/lib/jobs"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20

// Compact vipar-style jobs table — client-side search over
// customer / POL / POD / job no, paginated.
export function JobsTable({ jobs, totalCount }: { jobs: Job[]; totalCount: number }) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((j) =>
      [j.customer, j.pol, j.pod, j.job_no].filter(Boolean).join(" ").toLowerCase().includes(q),
    )
  }, [jobs, query])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const thCls =
    "border-b border-foreground/10 px-2.5 py-2 text-left text-[9.5px] font-medium tracking-widest text-muted-foreground uppercase"
  const tdCls = "border-b border-foreground/[0.06] px-2.5 py-2"

  return (
    <Card className="gap-0 rounded-2xl border-foreground/[0.06] bg-foreground/[0.02] p-6 shadow-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Jobs</span>
          <span className="text-xs text-muted-foreground/60">
            {rows.length.toLocaleString("en-IN")} shown
            {totalCount > jobs.length && ` · latest ${jobs.length} of ${totalCount.toLocaleString("en-IN")} in scope`}
          </span>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Search customer, POL, POD, job no…"
            className="h-8 rounded-full border-foreground/10 bg-foreground/[0.03] pl-9 text-xs"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr>
              <th className={thCls}>Month</th>
              <th className={thCls}>Dept</th>
              <th className={thCls}>Scope</th>
              <th className={thCls}>Customer</th>
              <th className={thCls}>CHA</th>
              <th className={thCls}>Nom / Freehand</th>
              <th className={thCls}>Mode</th>
              <th className={thCls}>POL → POD</th>
              <th className={cn(thCls, "text-right")}>Weight (kg)</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((j, i) => (
              <tr key={`${j.job_no || j.mbl_mawb || "row"}-${i}`} className="transition-colors hover:bg-foreground/[0.03]">
                <td className={cn(tdCls, "whitespace-nowrap text-muted-foreground tabular-nums")}>
                  {fmtMonth(j.month)}
                </td>
                <td className={cn(tdCls, "whitespace-nowrap")}>{j.department || "—"}</td>
                <td className={cn(tdCls, "whitespace-nowrap text-muted-foreground")}>{j.service_scope || "—"}</td>
                <td className={cn(tdCls, "max-w-52 truncate font-medium")} title={j.customer}>
                  {j.customer || "—"}
                </td>
                <td className={cn(tdCls, "max-w-36 truncate text-muted-foreground")} title={j.cha}>
                  {j.cha || "—"}
                </td>
                <td className={tdCls}>
                  {j.nomination_freehand ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        j.nomination_freehand === "Nomination"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-foreground/[0.06] text-muted-foreground",
                      )}
                    >
                      {j.nomination_freehand}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className={cn(tdCls, "whitespace-nowrap text-muted-foreground")}>{j.mode || "—"}</td>
                <td className={cn(tdCls, "max-w-44 truncate text-muted-foreground")} title={`${j.pol} → ${j.pod}`}>
                  {j.pol || "?"} <span className="text-muted-foreground/40">→</span> {j.pod || "?"}
                </td>
                <td className={cn(tdCls, "text-right tabular-nums")}>
                  {j.gross_wt_kg !== null ? j.gross_wt_kg.toLocaleString("en-IN") : "—"}
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No jobs match the search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between border-t border-foreground/[0.06] pt-3">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            Rows {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-lg border-foreground/10 px-3 text-[11px]"
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
            >
              Prev
            </Button>
            <span className="text-[11px] tabular-nums">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-lg border-foreground/10 px-3 text-[11px]"
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
