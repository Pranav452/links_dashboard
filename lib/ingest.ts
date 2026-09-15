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
  /** Non-blocking data-quality notes, aggregated (one line per issue, not per row). */
  warnings: string[]
  skippedEmpty: number
  /** Summary/total rows the branch added by hand — never imported. */
  skippedTotals: number
}

const KNOWN_BRANCHES = ["Ahmedabad", "Delhi Air", "Delhi Sea", "Baroda", "Bangalore", "Chennai", "Nashik"]

/** How branches actually write their own name. A bare "DELHI" is resolved later from the rows. */
const BRANCH_ALIASES: Record<string, string> = {
  AHMEDABAD: "Ahmedabad", AMD: "Ahmedabad", AHMADABAD: "Ahmedabad",
  "DELHI AIR": "Delhi Air", "DEL AIR": "Delhi Air",
  "DELHI SEA": "Delhi Sea", "DEL SEA": "Delhi Sea",
  BARODA: "Baroda", VADODARA: "Baroda", BRC: "Baroda",
  BANGALORE: "Bangalore", BENGALURU: "Bangalore", BLR: "Bangalore",
  CHENNAI: "Chennai", MADRAS: "Chennai", MAA: "Chennai",
  NASHIK: "Nashik", NASIK: "Nashik", NSK: "Nashik",
}

/** "Branch:  DELHI" -> "DELHI". A value without the label is returned unchanged. */
function stripLabel(v: string, label: string): string {
  return v.replace(new RegExp(`^\\s*${label}\\s*[:\\-]?\\s*`, "i"), "").trim()
}

function resolveBranch(raw: string): string | null {
  const k = raw.toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim()
  if (!k) return null
  if (BRANCH_ALIASES[k]) return BRANCH_ALIASES[k]
  if (k === "DELHI" || k === "DEL" || k === "NEW DELHI") return "DELHI"
  return canon(raw, KNOWN_BRANCHES)
}

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

/**
 * Year from a meta cell. A cell formatted as a date turns a typed 2026 into
 * serial day 2026 (18 Jul 1905), so recover the serial; a genuine date keeps its
 * own year; text yields its first 4-digit year.
 */
function yearOf(v: Cell): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const serial = Math.round((Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()) - Date.UTC(1899, 11, 30)) / 86_400_000)
    if (serial >= 2000 && serial <= 2100) return String(serial)
    const y = v.getFullYear()
    return y >= 2000 && y <= 2100 ? String(y) : ""
  }
  const m = str(v).match(/(20\d{2})/)
  return m ? m[1] : str(v)
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

  // Meta cells: B1 / E1 / H1 / K1. Branches often type into the LABEL cell
  // instead ("Branch: DELHI" in A1, "Month: AUG 2026" in D1), so each value
  // falls back to parsing its label cell.
  const meta = rows[0] ?? []
  const branchRaw = str(meta[1]) || stripLabel(str(meta[0]), "branch")
  const monthCell = str(meta[4]) || stripLabel(str(meta[3]), "month")
  const fortnight = str(meta[10]) || stripLabel(str(meta[9]), "fortnight")

  // "AUG 2026" / "August" — take the month word and, if present, the year.
  const yearInMonth = monthCell.match(/(20\d{2})/)?.[1] ?? ""
  const monthRaw = monthCell.replace(/20\d{2}/, "").replace(/[^A-Za-z]/g, " ").trim()
  const yearRaw = yearOf(meta[7]) || yearOf(stripLabel(str(meta[6]), "year")) || yearInMonth

  const missing: string[] = []
  if (!branchRaw) missing.push("Branch (B1)")
  if (!monthRaw) missing.push("Month (E1)")
  if (!yearRaw) missing.push("Year (H1)")
  if (missing.length > 0) {
    throw new Error(`Template meta cells missing: ${missing.join(", ")}. Fill the header row of the Jobs sheet.`)
  }

  const monthNo = monthNumber(monthRaw)
  if (monthNo === null) throw new Error(`Month cell has "${monthCell}" — expected a month name like "August" or "AUG 2026".`)
  const year = Number(yearRaw)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Year cell has "${yearRaw}" — expected a 4-digit year.`)
  }
  const month = `${year}-${String(monthNo).padStart(2, "0")}`

  const resolved = resolveBranch(branchRaw)
  if (!resolved) {
    throw new Error(`Branch "${branchRaw}" is not recognised — expected one of: ${KNOWN_BRANCHES.join(", ")}.`)
  }
  let branch = resolved === "DELHI" ? "" : resolved

  const jobs: Job[] = []
  const rowErrors: string[] = []
  let skippedEmpty = 0
  let skippedTotals = 0
  let blankScope = 0
  let blankDate = 0

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

    // Hand-added summary rows ("TOTAL" in a text column, sums under Buying and
    // Selling). Importing one would double-count every rupee in the month.
    const isTotalRow = !job_no && !customer && row.some((c) => /^\s*(grand\s+)?total\s*$/i.test(str(c)))
    if (isTotalRow) {
      skippedTotals++
      continue
    }

    if (!job_no && !customer) {
      rowErrors.push(`Row ${excelRow}: needs at least a Job No or a Customer — skipped.`)
      continue
    }

    const deptRaw = str(row[3])
    const department = deptRaw ? canon(deptRaw, DEPARTMENTS) : null
    if (!department) errors.push(`Department "${deptRaw || "(blank)"}" not in [${DEPARTMENTS.join(", ")}]`)

    // Service Scope: a wrong value is an error, but a BLANK one is imported and
    // reported once — rejecting a month over one unfilled column loses all of it.
    const scopeRaw = str(row[4])
    const service_scope = scopeRaw ? canon(scopeRaw, SERVICE_SCOPES) : ""
    if (scopeRaw && service_scope === null) {
      errors.push(`Service Scope "${scopeRaw}" not in [${SERVICE_SCOPES.join(", ")}]`)
    }
    if (!scopeRaw) blankScope++
    if (!str(row[2])) blankDate++

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
      service_scope: service_scope ?? "",
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

  const warnings: string[] = []

  if (!branch) {
    // "DELHI" is two branches — decide from what the rows actually are.
    const air = jobs.filter((j) => j.department.startsWith("Air")).length
    const sea = jobs.filter((j) => j.department.startsWith("Sea")).length
    if (air && !sea) branch = "Delhi Air"
    else if (sea && !air) branch = "Delhi Sea"
    else {
      throw new Error(
        `Branch is just "${branchRaw}" and the rows mix air (${air}) and sea (${sea}) — write "Delhi Air" or "Delhi Sea".`,
      )
    }
    for (const j of jobs) j.branch = branch
    warnings.push(
      `Branch was written as "${branchRaw}" — treated as ${branch} because every row is ${air ? "air" : "sea"}. Pick the branch from the dropdown in B1 next time.`,
    )
  }

  if (blankScope) {
    warnings.push(`Service Scope is blank on ${blankScope} of ${jobs.length} rows — imported without it (it is a mandatory column).`)
  }
  if (blankDate) {
    warnings.push(`Job Date is blank on ${blankDate} of ${jobs.length} rows — imported without dates.`)
  }
  const withMoney = jobs.filter((j) => j.buying_inr !== null || j.selling_inr !== null).length
  if (jobs.length && withMoney < jobs.length) {
    warnings.push(`Buying/Selling filled on ${withMoney} of ${jobs.length} rows — the rest count as jobs but not towards profit.`)
  }
  if (skippedTotals) {
    warnings.push(`Skipped ${skippedTotals} hand-added TOTAL row(s) so amounts are not double-counted.`)
  }

  return { branch, month, fortnight, jobs, rowErrors, warnings, skippedEmpty, skippedTotals }
}
