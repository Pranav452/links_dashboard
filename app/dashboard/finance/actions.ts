"use server"

import { revalidatePath } from "next/cache"

import { audit, getSession } from "@/lib/auth"
import { loadExpenses, saveExpenses } from "@/lib/store"

// Saves the branch × month fixed-expenses grid. Field names are
// "exp|<branch>|<YYYY-MM>"; empty values clear the cell.
export async function saveExpensesGrid(formData: FormData): Promise<void> {
  const session = await getSession()
  if (!session || session.role !== "admin") return

  const expenses = await loadExpenses()
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("exp|")) continue
    const [, branch, month] = key.split("|")
    if (!branch || !month) continue
    const text = String(raw).trim().replace(/,/g, "")
    const row = (expenses[branch] ??= {})
    if (text === "") {
      delete row[month]
      continue
    }
    const value = Number(text)
    if (!Number.isFinite(value) || value < 0) continue // ignore junk, keep old value
    row[month] = value
  }
  // Drop branches that ended up empty.
  for (const branch of Object.keys(expenses)) {
    if (Object.keys(expenses[branch]).length === 0) delete expenses[branch]
  }

  await saveExpenses(expenses)
  await audit("expenses-saved", { user: session.u })
  revalidatePath("/dashboard/finance")
}
