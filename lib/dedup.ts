// Duplicate / non-shipment detection for links_jobs rows.
//
// The branches' own monthly sheets repeat work: last month's lines are copied
// forward into the new tab, a shipment is logged once as freight and again as
// its clearance, and cancelled / amendment / drawback lines are entered as if
// they were jobs. Those rows are copied into links_jobs faithfully, so they are
// HIDDEN (links_jobs.excluded_reason) rather than deleted — see scripts/dedup.ts.
//
// Pure and deterministic: rows are processed per branch in month order, then
// by id, and the earliest occurrence is always the one that stays visible.
// Rules are a port of the Sept-2026 audit simulation (dbsim.mjs). Review-only
// buckets from that audit (same-month identical lines without a job no,
// clearance rows without a BL, shipments shared across branches) are NOT
// flagged here on purpose.

import type { Job } from "./jobs"

export type DedupJob = Pick<
  Job,
  | "branch"
  | "month"
  | "department"
  | "service_scope"
  | "customer"
  | "mbl_mawb"
  | "pol"
  | "pod"
  | "origin"
  | "final_destination"
  | "carrier"
  | "remarks"
  | "packages"
  | "gross_wt_kg"
  | "container_size"
> & { id: number | string }

export const REASON_NON_SHIPMENT = "non-shipment"
export const REASON_CLEARANCE_REPEAT = "clearance-repeat"
export const REASON_FORWARDING_REPEAT = "forwarding-repeat"
export const REASON_COPIED_PREFIX = "copied-from-"

/** Uppercase, strip everything that is not A-Z / 0-9. */
export function normToken(s: unknown): string {
  return String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

const ID_FIELDS = ["mbl_mawb", "pol", "pod", "origin", "final_destination", "remarks", "carrier"] as const

// Separators between shipment numbers written into one cell. The lookahead
// splits "BL123456 HAWB H998877" style runs on the space before a label word.
const ID_SPLIT = /[/,&;]| - |::|=|\s(?=[A-Z]{2,}\s)/
const ID_LABEL = /^\s*(Cnee:|Nom\/Freehand:|HBL|HAWB|MBL|M\/BL|BL)\s*:?/i

/**
 * Shipment numbers (MBL/MAWB/HBL/HAWB/container-ish references) found anywhere
 * in a row: tokens of >= 6 chars carrying >= 4 digits, sorted and unique.
 */
export function shipmentNumbers(job: DedupJob): string[] {
  const out = new Set<string>()
  for (const field of ID_FIELDS) {
    for (const part of String(job[field] ?? "").split(ID_SPLIT)) {
      const n = normToken(part.replace(ID_LABEL, "")).replace(/^(HBL|HAWB|MBL)/, "")
      if (n.length >= 6 && (n.match(/\d/g) ?? []).length >= 4 && !/^0+$/.test(n)) out.add(n)
    }
  }
  return [...out].sort()
}

/** House numbers are written both as "H1022600394" and "1022600394". */
function looseNumbers(ids: string[]): string[] {
  return ids.map((id) => (/^H\d{6,}$/.test(id) ? id.slice(1) : id))
}

function isNonShipment(job: DedupJob): boolean {
  const mbl = String(job.mbl_mawb ?? "")
  const customer = String(job.customer ?? "").trim()
  return (
    /^CANCEL$/i.test(mbl) ||
    /AMENDMENT/i.test(mbl) ||
    /Non-shipment entry/i.test(String(job.remarks ?? "")) ||
    /^(DBK|DRAW ?BACK)$/i.test(mbl.trim()) ||
    // A bare shipping-bill / BoE number typed into the customer column with no
    // shipment attached (e.g. "BLR1100012345").
    (/^[A-Z]{3}11[02]\d{6,}$/.test(customer) && !job.mbl_mawb && !job.pod && !job.pol)
  )
}

function copySignature(job: DedupJob, ids: string[]): string {
  return [
    job.department,
    job.service_scope,
    normToken(job.customer),
    ids.join("+"),
    normToken(job.pod),
    job.packages ?? "",
    job.gross_wt_kg ?? "",
    normToken(job.container_size),
  ].join("|")
}

function byMonthThenId(a: DedupJob, b: DedupJob): number {
  if (a.month !== b.month) return a.month < b.month ? -1 : 1
  const ai = Number(a.id)
  const bi = Number(b.id)
  if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi
  return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0
}

interface Entry {
  job: DedupJob
  ids: string[]
  loose: string[]
}

/**
 * Flags duplicate / non-shipment rows. Returns rowId -> reason for every row
 * that should be hidden; unflagged rows are genuine jobs. Rules, first match
 * wins, applied per branch in month order:
 *
 *  a. non-shipment      CANCEL / AMENDMENT / DBK / DRAW BACK in MBL, "Non-shipment
 *                       entry" remark, or a bare SB/BoE number as the customer.
 *  b. copied-from-<m>   identical department + scope + customer + shipment
 *                       numbers + POD + packages + gross wt + container size as
 *                       a row in an EARLIER month <m> of the same branch.
 *     (b2)              the same numeric HAWB/HBL (with or without its "H"
 *                       prefix; never the master MBL/MAWB), same department,
 *                       packages and gross weight as an earlier month's row —
 *                       a copied line re-typed in a new sheet layout.
 *  c. clearance-repeat  "Clearance Only" row sharing a shipment number with a
 *                       freight row of the same branch + month.
 *  d. forwarding-repeat "Freight Only" row whose MBL/MAWB equals a
 *                       "Freight + Clearance" row's in the same branch + month.
 */
export function flagDuplicates(jobs: readonly DedupJob[]): Map<DedupJob["id"], string> {
  const flags = new Map<DedupJob["id"], string>()

  const byBranch = new Map<string, DedupJob[]>()
  for (const job of jobs) {
    const list = byBranch.get(job.branch)
    if (list) list.push(job)
    else byBranch.set(job.branch, [job])
  }

  for (const branch of [...byBranch.keys()].sort()) {
    const rows = [...byBranch.get(branch)!].sort(byMonthThenId)

    const firstMonthBySig = new Map<string, string>()
    // loose shipment number -> earlier-month rows carrying it
    const earlierByNumber = new Map<string, { month: string; job: DedupJob }[]>()

    let i = 0
    while (i < rows.length) {
      const month = rows[i].month
      const monthRows: Entry[] = []
      while (i < rows.length && rows[i].month === month) {
        const ids = shipmentNumbers(rows[i])
        monthRows.push({ job: rows[i], ids, loose: looseNumbers(ids) })
        i++
      }

      for (const { job, ids, loose } of monthRows) {
        const sig = ids.length > 0 ? copySignature(job, ids) : null
        let reason: string | null = null

        if (isNonShipment(job)) {
          reason = REASON_NON_SHIPMENT
        } else if (sig !== null && firstMonthBySig.has(sig) && firstMonthBySig.get(sig) !== month) {
          reason = REASON_COPIED_PREFIX + firstMonthBySig.get(sig)
        } else if (job.packages !== null && job.gross_wt_kg !== null) {
          const hit = loose
            .filter((n) => /^\d{8,}$/.test(n))
            .flatMap((n) => earlierByNumber.get(n) ?? [])
            .find(
              (e) =>
                e.month < month &&
                e.job.department === job.department &&
                e.job.packages === job.packages &&
                e.job.gross_wt_kg === job.gross_wt_kg,
            )
          if (hit) reason = REASON_COPIED_PREFIX + hit.month
        }

        if (
          reason === null &&
          job.service_scope === "Clearance Only" &&
          ids.length > 0 &&
          monthRows.some((f) => f.job.service_scope !== "Clearance Only" && f.ids.some((x) => ids.includes(x)))
        ) {
          reason = REASON_CLEARANCE_REPEAT
        }

        if (reason === null && job.service_scope === "Freight Only") {
          const mbl = normToken(job.mbl_mawb)
          if (
            mbl &&
            monthRows.some(
              (f) => f.job !== job && f.job.service_scope === "Freight + Clearance" && normToken(f.job.mbl_mawb) === mbl,
            )
          ) {
            reason = REASON_FORWARDING_REPEAT
          }
        }

        if (reason !== null) flags.set(job.id, reason)
        if (sig !== null && !firstMonthBySig.has(sig)) firstMonthBySig.set(sig, month)
      }

      // Register this month's house numbers only after the month is processed,
      // so the loose rule can only ever match an EARLIER month.
      // Only HOUSE numbers are registered: a master (MBL/MAWB) is shared by every
      // house under it, so matching on it alone would over-flag consols.
      for (const { job, loose } of monthRows) {
        const master = normToken(job.mbl_mawb)
        for (const n of loose) {
          if (!/^\d{8,}$/.test(n) || n === master) continue
          const list = earlierByNumber.get(n)
          if (list) list.push({ month, job })
          else earlierByNumber.set(n, [{ month, job }])
        }
      }
    }
  }

  return flags
}

/** "copied-from-2026-07" -> "copied-forward" (bucket for summaries). */
export function reasonBucket(reason: string): string {
  return reason.startsWith(REASON_COPIED_PREFIX) ? "copied-forward" : reason
}
