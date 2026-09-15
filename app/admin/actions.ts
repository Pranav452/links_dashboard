"use server"

import { revalidatePath } from "next/cache"

import { audit, getSession } from "@/lib/auth"
import { parseTemplate } from "@/lib/ingest"
import { fmtMonth } from "@/lib/jobs"
import { loadJobsMeta, replaceBranchMonth } from "@/lib/store"

const MAX_BYTES = 8 * 1024 * 1024

export interface IngestState {
  error?: string
  success?: boolean
  fileName?: string
  branch?: string
  month?: string
  fortnight?: string
  added?: number
  replaced?: number
  skippedEmpty?: number
  rowErrors?: string[]
  warnings?: string[]
  totalJobs?: number
}

// Parses a filled productivity template and REPLACES that branch+month's rows
// in links_jobs (one transactional delete + insert). Every other branch and
// month is untouched; the swap is logged to links_uploads.
export async function ingestTemplate(_prev: IngestState, formData: FormData): Promise<IngestState> {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return { error: "Session expired or not permitted. Sign in as admin again." }
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose the filled template file first." }
  }
  const name = file.name.toLowerCase()
  if (!name.endsWith(".xlsx") && !name.endsWith(".xlsm") && !name.endsWith(".xls")) {
    return { error: "Unsupported file type — upload the .xlsx productivity template." }
  }
  if (file.size > MAX_BYTES) {
    return { error: "File is larger than 8 MB." }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = parseTemplate(buffer)

    if (parsed.jobs.length === 0) {
      return {
        error:
          parsed.rowErrors.length > 0
            ? `No valid rows — every data row failed validation. First issue: ${parsed.rowErrors[0]}`
            : "No data rows found from row 4 of the Jobs sheet.",
        rowErrors: parsed.rowErrors,
      }
    }

    const { deleted, inserted } = await replaceBranchMonth(
      parsed.branch,
      parsed.month,
      parsed.jobs,
      `upload:${file.name} · ${parsed.branch} ${fmtMonth(parsed.month)}`,
      session.u,
    )

    const meta = await loadJobsMeta()

    await audit("template-ingested", {
      user: session.u,
      file: file.name,
      branch: parsed.branch,
      month: parsed.month,
      added: String(inserted),
      replaced: String(deleted),
    })
    revalidatePath("/", "layout")

    return {
      success: true,
      fileName: file.name,
      branch: parsed.branch,
      month: parsed.month,
      fortnight: parsed.fortnight,
      added: inserted,
      replaced: deleted,
      skippedEmpty: parsed.skippedEmpty,
      rowErrors: parsed.rowErrors,
      warnings: parsed.warnings,
      totalJobs: meta.total,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
