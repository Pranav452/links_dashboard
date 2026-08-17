// Parser for the "LINKS Branch Productivity Template" workbook.
// Layout (Jobs sheet): meta row 1 — B1 branch, E1 month name, H1 year,
// K1 fortnight; header row 3; data rows from row 4, columns:
//   A Sr No · B Job No · C Job Date · D Department · E Service Scope
//   F Customer · G CHA · H Nomination/Freehand · I Nomination Agent
//   J Carrier · K MBL/MAWB · L HBL Type · M Mode · N Containers
//   O Container Size · P Packages · Q Gross Wt (Kg) · R Chargeable Wt (Kg)
//   S Origin · T POL · U POD · V Final Destination · W Buying (INR)
//   X Selling (INR) · Y Profit (computed — ignored) · Z Remarks

import * as XLSX from "xlsx"

import {
  DEPARTMENTS,
  MODES,
  MONTH_FULL_NAMES,
  NOMINATION_TYPES,
  SERVICE_SCOPES,
  type Job,
} from "./jobs"

export interface ParsedTemplate {
  branch: string
  month: string // "YYYY-MM"
  fortnight: string
  jobs: Job[]
  rowErrors: string[]
  skippedEmpty: number
}

const KNOWN_BRANCHES = ["Ahmedabad", "Delhi Air", "Delhi Sea", "Baroda", "Bangalore", "Chennai", "Nashik"]

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

type Cell = string | number | boolean | Date | null | undefined

const str = (v: Cell): string => (v === null || v === undefined ? "" : String(v).trim())

function num(v: Cell, field: string, errors: string[]): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim())
  if (!Number.isFinite(n)) {
    errors.push(`${field} "${String(v)}" is not a number`)
    return null
  }
  return n
}

/** Canonicalize against an allowed list (case/spacing-insensitive). */
function canon(v: string, allowed: readonly string[]): string | null {
  const key = v.toLowerCase().replace(/[^a-z0-9+]/g, "")
  return allowed.find((a) => a.toLowerCase().replace(/[^a-z0-9+]/g, "") === key) ?? null
}

/** Job date → ISO "YYYY-MM-DD". Accepts Date cells, DD-MM-YYYY, DD/MM/YYYY, ISO. */
function toIsoDate(v: Cell): string {
  if (v === null || v === undefined) return ""
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, "0")
    const d = String(v.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  const s = String(v).trim()
  if (!s) return ""
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const dm = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (dm) return `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`
  return s // keep as-is rather than losing information
}

function monthNumber(name: string): number | null {
  const key = name.toLowerCase().slice(0, 3)
  const idx = MONTH_FULL_NAMES.findIndex((m) => m.toLowerCase().startsWith(key))
  return idx >= 0 ? idx + 1 : null
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/** Parses a filled template. Throws for structural problems (missing meta / sheet). */
export function parseTemplate(buffer: Buffer): ParsedTemplate {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === "jobs") ?? wb.SheetNames[0]
  const ws = sheetName ? wb.Sheets[sheetName] : undefined
  if (!ws) throw new Error("Workbook has no sheets — is this the productivity template?")

  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, blankrows: true, defval: null })

  // Meta cells: B1 / E1 / H1 / K1 (row index 0, col indexes 1 / 4 / 7 / 10)
  const meta = rows[0] ?? []
  const branchRaw = str(meta[1])
  const monthRaw = str(meta[4])
  const yearRaw = str(meta[7])
  const fortnight = str(meta[10])

  const missing: string[] = []
  if (!branchRaw) missing.push("Branch (B1)")
  if (!monthRaw) missing.push("Month (E1)")
  if (!yearRaw) missing.push("Year (H1)")
  if (missing.length > 0) {
    throw new Error(`Template meta cells missing: ${missing.join(", ")}. Fill the header row of the Jobs sheet.`)
  }

  const branch = canon(branchRaw, KNOWN_BRANCHES) ?? branchRaw
  const monthNo = monthNumber(monthRaw)
  if (monthNo === null) throw new Error(`Month cell (E1) has "${monthRaw}" — expected a month name like "April".`)
  const year = Number(yearRaw)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Year cell (H1) has "${yearRaw}" — expected a 4-digit year.`)
  }
  const month = `${year}-${String(monthNo).padStart(2, "0")}`

  const jobs: Job[] = []
  const rowErrors: string[] = []
  let skippedEmpty = 0

  for (let r = 3; r < rows.length; r++) {
    const row = rows[r] ?? []
    // Cells B..Z → indexes 1..25 (index 0 = Sr No, index 24 = computed Profit)
    const cells = row.slice(1, 26)
    const hasContent = cells.some((c) => str(c) !== "")
    if (!hasContent) {
      skippedEmpty++
      continue
    }

    const excelRow = r + 1
    const errors: string[] = []

    const job_no = str(row[1])
    const customer = str(row[5])
    if (!job_no && !customer) {
      rowErrors.push(`Row ${excelRow}: needs at least a Job No or a Customer — skipped.`)
      continue
    }

    const deptRaw = str(row[3])
    const department = deptRaw ? canon(deptRaw, DEPARTMENTS) : null
    if (!department) errors.push(`Department "${deptRaw || "(blank)"}" not in [${DEPARTMENTS.join(", ")}]`)

    const scopeRaw = str(row[4])
    const service_scope = scopeRaw ? canon(scopeRaw, SERVICE_SCOPES) : null
    if (!service_scope) errors.push(`Service Scope "${scopeRaw || "(blank)"}" not in [${SERVICE_SCOPES.join(", ")}]`)

    const modeRaw = str(row[12])
    const mode = modeRaw ? canon(modeRaw, MODES) : null
    if (!mode) errors.push(`Mode "${modeRaw || "(blank)"}" not in [${MODES.join(", ")}]`)

    const nomRaw = str(row[7])
    const nomination = nomRaw ? canon(nomRaw, NOMINATION_TYPES) : ""
    if (nomRaw && nomination === null) {
      errors.push(`Nomination/Freehand "${nomRaw}" not in [${NOMINATION_TYPES.join(", ")}]`)
    }

    const containers_count = num(row[13], "Containers", errors)
    const packages = num(row[15], "Packages", errors)
    const gross_wt_kg = num(row[16], "Gross Wt", errors)
    const chargeable_wt_kg = num(row[17], "Chargeable Wt", errors)
    const buying_inr = num(row[22], "Buying", errors)
    const selling_inr = num(row[23], "Selling", errors)

    if (errors.length > 0) {
      rowErrors.push(`Row ${excelRow} (${job_no || customer}): ${errors.join("; ")} — skipped.`)
      continue
    }

    jobs.push({
      branch,
      month,
      department: department!,
      service_scope: service_scope!,
      job_no,
      job_date: toIsoDate(row[2]),
      customer,
      cha: str(row[6]),
      nomination_freehand: nomination ?? "",
      nomination_agent: str(row[8]),
      carrier: str(row[9]),
      mbl_mawb: str(row[10]),
      hbl_type: str(row[11]),
      mode: mode!,
      containers_count,
      container_size: str(row[14]),
      packages,
      gross_wt_kg,
      chargeable_wt_kg,
      origin: str(row[18]),
      pol: str(row[19]),
      pod: str(row[20]),
      final_destination: str(row[21]),
      buying_inr,
      selling_inr,
      remarks: str(row[25]),
    })
  }

  return { branch, month, fortnight, jobs, rowErrors, skippedEmpty }
}
