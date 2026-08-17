import { Briefcase, Building2, CalendarRange, IndianRupee } from "lucide-react"

import { KpiCard } from "@/components/charts/kpi-card"
import { SiteHeader } from "@/components/site-header"
import { distinct, fmtMonth, jobGpInr } from "@/lib/jobs"
import { loadJobs } from "@/lib/store"

// Placeholder dashboard — proves the data layer end to end.
// Stage 2 replaces this with the full branch-productivity analytics.
export default async function DashboardPage() {
  const dataset = await loadJobs()
  const { jobs } = dataset

  const branches = distinct(jobs, "branch")
  const months = distinct(jobs, "month")
  const gp = jobs.reduce((acc, j) => acc + (jobGpInr(j) ?? 0), 0)

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Branch productivity</h1>
          <p className="text-xs text-muted-foreground">
            {dataset.source === "none"
              ? "No data loaded yet — run npx tsx scripts/seed.ts or upload from the admin panel."
              : `Source: ${dataset.source}${dataset.updatedAt ? ` · updated ${new Date(dataset.updatedAt).toLocaleString("en-IN")}` : ""}`}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Jobs"
            value={jobs.length.toLocaleString("en-IN")}
            sub="Across all branches and months"
            icon={<Briefcase />}
            accent
          />
          <KpiCard
            label="Branches"
            value={String(branches.length)}
            sub={branches.join(" · ") || "—"}
            icon={<Building2 />}
          />
          <KpiCard
            label="Months"
            value={String(months.length)}
            sub={months.length > 0 ? `${fmtMonth(months[0])} — ${fmtMonth(months[months.length - 1])}` : "—"}
            icon={<CalendarRange />}
          />
          <KpiCard
            label="Gross profit"
            value={`₹${Math.round(gp).toLocaleString("en-IN")}`}
            sub="Selling − buying, where reported"
            icon={<IndianRupee />}
          />
        </div>
      </main>
    </>
  )
}
