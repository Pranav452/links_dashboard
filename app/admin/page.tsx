import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Database, FileSpreadsheet, History, KeyRound, RotateCcw } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getSession } from "@/lib/auth"
import { dbEnabled } from "@/lib/db"
import { fmtNum } from "@/lib/analytics"
import { listVersions, loadJobs } from "@/lib/store"
import { activateVersionAction } from "./actions"
import { UploadForm } from "./upload-form"

export const metadata: Metadata = {
  title: "Admin · LINKS Branch Analytics",
}

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const session = await getSession()
  if (!session || session.role !== "admin") redirect("/dashboard")

  const [dataset, versions] = await Promise.all([loadJobs(), listVersions()])
  const hasDb = dbEnabled()

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
              {hasDb ? "Neon versioned storage" : "File mode (data/jobs.json)"}
            </Badge>
          </div>
        </div>

        {/* Upload ingest */}
        <Card className="gap-4 rounded-2xl border-foreground/[0.06] bg-foreground/[0.02] p-6 shadow-none">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium tracking-widest uppercase">Upload productivity template</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Upload a filled &ldquo;LINKS Branch Productivity Template&rdquo; (.xlsx). The Jobs sheet must carry
            Branch, Month and Year in the header cells — the upload{" "}
            <span className="font-medium text-foreground">replaces that branch + month</span> in the dataset and
            leaves every other branch and month untouched. Rows failing validation are listed and skipped.
          </p>
          <UploadForm />
        </Card>

        {/* Version history / dataset info */}
        <Card className="mt-4 gap-4 rounded-2xl border-foreground/[0.06] bg-foreground/[0.02] p-6 shadow-none">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium tracking-widest uppercase">
              {hasDb ? "Version history" : "Current dataset"}
            </span>
          </div>

          {hasDb ? (
            versions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="border-b border-foreground/10 px-3 py-2 text-left text-[10px] font-medium tracking-widest text-muted-foreground uppercase">#</th>
                      <th className="border-b border-foreground/10 px-3 py-2 text-left text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Source</th>
                      <th className="border-b border-foreground/10 px-3 py-2 text-left text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Uploaded</th>
                      <th className="border-b border-foreground/10 px-3 py-2 text-left text-[10px] font-medium tracking-widest text-muted-foreground uppercase">By</th>
                      <th className="border-b border-foreground/10 px-3 py-2 text-right text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Jobs</th>
                      <th className="border-b border-foreground/10 px-3 py-2 text-right text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v) => (
                      <tr key={v.id} className="transition-colors hover:bg-foreground/[0.03]">
                        <td className="border-b border-foreground/[0.06] px-3 py-2.5 tabular-nums">#{v.id}</td>
                        <td className="max-w-72 truncate border-b border-foreground/[0.06] px-3 py-2.5" title={v.source}>
                          {v.source}
                        </td>
                        <td className="border-b border-foreground/[0.06] px-3 py-2.5 whitespace-nowrap text-muted-foreground tabular-nums">
                          {new Date(v.uploaded_at).toLocaleString("en-IN")}
                        </td>
                        <td className="border-b border-foreground/[0.06] px-3 py-2.5 text-muted-foreground">
                          {v.uploaded_by ?? "—"}
                        </td>
                        <td className="border-b border-foreground/[0.06] px-3 py-2.5 text-right tabular-nums">
                          {fmtNum(v.job_count)}
                        </td>
                        <td className="border-b border-foreground/[0.06] px-3 py-2.5 text-right">
                          {v.active ? (
                            <Badge className="rounded-full bg-emerald-500/10 px-2.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              Active
                            </Badge>
                          ) : (
                            <form action={activateVersionAction} className="inline">
                              <input type="hidden" name="id" value={v.id} />
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                className="h-6 gap-1 rounded-full border-foreground/10 px-2.5 text-[10px]"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Activate
                              </Button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No versions stored yet — upload a template to create one.</p>
            )
          ) : (
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground tabular-nums">{fmtNum(dataset.jobs.length)}</span> jobs
                loaded
              </span>
              <span>Source: {dataset.source}</span>
              <span>
                Updated: {dataset.updatedAt ? new Date(dataset.updatedAt).toLocaleString("en-IN") : "—"}
              </span>
              <span className="w-full text-muted-foreground/60">
                Versioning and rollback activate automatically once DATABASE_URL is configured — file mode keeps a
                single current dataset in data/jobs.json.
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
              (admin — uploads, expenses, versions).
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
