import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Database, FileSpreadsheet, History, KeyRound } from "lucide-react"

import { DataErrorCard } from "@/components/data-error"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getSession } from "@/lib/auth"
import { dbEnabled } from "@/lib/db"
import { fmtNum } from "@/lib/analytics"
import { fmtMonth } from "@/lib/jobs"
import { dataErrorMessage, listUploads, loadJobsMeta, type JobsMeta, type UploadLogEntry } from "@/lib/store"
import { UploadForm } from "./upload-form"

export const metadata: Metadata = {
  title: "Admin · LINKS Branch Analytics",
}

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const session = await getSession()
  if (!session || session.role !== "admin") redirect("/dashboard")

  // Aggregates + the ingest log only — the admin page never pulls job rows.
  let meta: JobsMeta | null = null
  let uploads: UploadLogEntry[] = []
  let dataError: string | null = null
  try {
    ;[meta, uploads] = await Promise.all([loadJobsMeta(), listUploads(50)])
  } catch (err) {
    dataError = dataErrorMessage(err)
  }

  const hasDb = dbEnabled()

  const thCls =
    "border-b border-foreground/10 px-3 py-2 text-left text-[10px] font-medium tracking-widest text-muted-foreground uppercase"
  const tdCls = "border-b border-foreground/[0.06] px-3 py-2.5"

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-widest text-muted-foreground/70 uppercase">
            <span>LINKS</span>
            <span className="text-muted-foreground/30">/</span>
            <span>Admin</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Data administration</h1>
            <Badge
              variant="outline"
              className="gap-1.5 rounded-full border-foreground/10 bg-foreground/[0.03] px-3 py-1 text-[11px] font-normal text-muted-foreground"
            >
              <Database className="h-3 w-3" />
              {hasDb
                ? meta
                  ? `Neon · links_jobs · ${fmtNum(meta.total)} rows`
                  : "Neon · unreachable"
                : "DATABASE_URL not set"}
            </Badge>
          </div>
        </div>

        {dataError && (
          <div className="mb-4">
            <DataErrorCard message={dataError} />
          </div>
        )}

        {/* Upload ingest */}
        <Card className="gap-4 rounded-2xl border-foreground/[0.06] bg-foreground/[0.02] p-6 shadow-none">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium tracking-widest uppercase">Upload productivity template</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Upload a filled &ldquo;LINKS Branch Productivity Template&rdquo; (.xlsx). The Jobs sheet must carry
            Branch, Month and Year in the header cells — the upload{" "}
            <span className="font-medium text-foreground">replaces that branch + month</span> in{" "}
            <code className="rounded bg-foreground/[0.06] px-1 py-0.5 font-mono text-[11px]">links_jobs</code> and
            leaves every other branch and month untouched. Rows failing validation are listed and skipped. To roll a
            month back, simply re-upload that branch + month — the swap is scoped and transactional.
          </p>
          <UploadForm />
        </Card>

        {/* Recent uploads */}
        <Card className="mt-4 gap-4 rounded-2xl border-foreground/[0.06] bg-foreground/[0.02] p-6 shadow-none">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium tracking-widest uppercase">Recent uploads</span>
          </div>

          {uploads.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className={thCls}>Branch</th>
                    <th className={thCls}>Month</th>
                    <th className={`${thCls} text-right`}>Rows in</th>
                    <th className={`${thCls} text-right`}>Rows removed</th>
                    <th className={thCls}>By</th>
                    <th className={thCls}>When</th>
                    <th className={thCls}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-foreground/[0.03]">
                      <td className={`${tdCls} font-medium whitespace-nowrap`}>{u.branch}</td>
                      <td className={`${tdCls} whitespace-nowrap tabular-nums`}>{fmtMonth(u.month)}</td>
                      <td className={`${tdCls} text-right tabular-nums text-emerald-600 dark:text-emerald-400`}>
                        +{fmtNum(u.rows_inserted)}
                      </td>
                      <td className={`${tdCls} text-right tabular-nums text-muted-foreground`}>
                        {u.rows_deleted > 0 ? `−${fmtNum(u.rows_deleted)}` : "—"}
                      </td>
                      <td className={`${tdCls} text-muted-foreground`}>{u.uploaded_by ?? "—"}</td>
                      <td className={`${tdCls} whitespace-nowrap text-muted-foreground tabular-nums`}>
                        {u.uploaded_at ? new Date(u.uploaded_at).toLocaleString("en-IN") : "—"}
                      </td>
                      <td className={`max-w-72 truncate ${tdCls} text-muted-foreground`} title={u.source}>
                        {u.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {dataError
                ? "Upload log unavailable while the database is unreachable."
                : "No uploads recorded yet — upload a branch template above to create the first entry."}
            </p>
          )}

          {meta && (
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground tabular-nums">{fmtNum(meta.total)}</span> job rows
              </span>
              <span>
                <span className="font-semibold text-foreground tabular-nums">{meta.branches.length}</span> branches ·{" "}
                <span className="font-semibold text-foreground tabular-nums">{meta.months.length}</span> months
              </span>
              <span>
                Last ingest: {meta.lastUpload ? new Date(meta.lastUpload).toLocaleString("en-IN") : "—"}
              </span>
            </div>
          )}
        </Card>

        {/* Users note */}
        <Card className="mt-4 gap-3 rounded-2xl border-foreground/[0.06] bg-foreground/[0.02] p-6 shadow-none">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium tracking-widest uppercase">Access</span>
          </div>
          <div className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <span>
              Without a database, two fallback logins are active:{" "}
              <code className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[11px]">links / links</code>{" "}
              (viewer — dashboards only) and{" "}
              <code className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[11px]">admin / admin123</code>{" "}
              (admin — uploads, expenses). Dashboards stay empty until DATABASE_URL is set.
            </span>
            <span className="text-muted-foreground/60">
              With DATABASE_URL set, users live in the links_users table and the fallbacks only apply for usernames not
              present there. Override the fallbacks via LINKS_USER / LINKS_PASS / LINKS_ADMIN_USER / LINKS_ADMIN_PASS.
            </span>
          </div>
        </Card>
      </main>
    </div>
  )
}
