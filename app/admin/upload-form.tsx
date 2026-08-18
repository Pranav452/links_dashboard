"use client"

import { useActionState, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, FileSpreadsheet, Loader2, TriangleAlert, UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { fmtMonth } from "@/lib/jobs"
import { cn } from "@/lib/utils"
import { ingestTemplate, type IngestState } from "./actions"

export function UploadForm() {
  const [state, action, pending] = useActionState<IngestState, FormData>(ingestTemplate, {})
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files?.[0]
            if (file && inputRef.current) {
              const dt = new DataTransfer()
              dt.items.add(file)
              inputRef.current.files = dt.files
              setFileName(file.name)
            }
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-10 text-center transition-all duration-300",
            dragging
              ? "border-emerald-500/60 bg-emerald-500/[0.06]"
              : "border-foreground/15 bg-foreground/[0.02] hover:border-foreground/30 hover:bg-foreground/[0.04]",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept=".xlsx,.xlsm,.xls"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
          {fileName ? (
            <>
              <FileSpreadsheet className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium">{fileName}</span>
              <span className="text-xs text-muted-foreground">Click to choose a different file</span>
            </>
          ) : (
            <>
              <UploadCloud className="h-8 w-8 text-muted-foreground/60" />
              <span className="text-sm font-medium">Drop the filled productivity template here</span>
              <span className="text-xs text-muted-foreground">
                or click to browse · .xlsx — Branch / Month / Year meta cells must be filled
              </span>
            </>
          )}
        </label>

        <Button type="submit" disabled={pending} className="h-10 w-fit rounded-xl px-6">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {pending ? "Parsing & replacing…" : "Upload & replace branch month"}
        </Button>
      </form>

      {state.error && (
        <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-xs font-medium text-destructive">{state.error}</p>
          {state.rowErrors && state.rowErrors.length > 0 && (
            <ul className="max-h-40 overflow-auto rounded-lg bg-background/40 p-2 text-[11px] leading-relaxed text-destructive/90">
              {state.rowErrors.map((e, i) => (
                <li key={i}>· {e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.success && (
        <Card className="gap-3 rounded-2xl border-emerald-500/20 bg-emerald-500/[0.04] p-5 shadow-none">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium">
              {state.branch} · {state.month ? fmtMonth(state.month) : ""} ingested
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <span>
              <span className="font-semibold text-foreground">{state.added}</span> rows added
            </span>
            <span>
              <span className="font-semibold text-foreground">{state.replaced}</span> previous rows deleted
            </span>
            {(state.skippedEmpty ?? 0) > 0 && <span>{state.skippedEmpty} empty rows skipped</span>}
            {state.fortnight && <span>Fortnight: {state.fortnight}</span>}
            <span>{state.totalJobs?.toLocaleString("en-IN")} jobs in dataset now</span>
          </div>
          {state.rowErrors && state.rowErrors.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <TriangleAlert className="h-3.5 w-3.5" />
                {state.rowErrors.length} rows failed validation and were not imported
              </span>
              <ul className="max-h-40 overflow-auto rounded-xl bg-foreground/[0.03] p-3 text-[11px] leading-relaxed text-muted-foreground">
                {state.rowErrors.map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
              </ul>
            </div>
          )}
          <Button asChild size="sm" className="group w-fit rounded-full px-4">
            <Link href="/dashboard">
              Open updated dashboard
              <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </Card>
      )}
    </div>
  )
}
