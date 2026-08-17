"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export interface NavBranch {
  name: string
  slug: string
}

// Header navigation — preserves the active ?month=/&branch= filter across
// pages so the selection follows the user (links carry the query through).
export function NavLinks({ branches, isAdmin }: { branches: NavBranch[]; isAdmin: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const qs = searchParams.toString()
  const withQuery = (href: string) => (qs ? `${href}?${qs}` : href)
  // Branch pages carry the branch in the path — keep only the month param.
  const month = searchParams.get("month")
  const branchHref = (slug: string) =>
    month ? `/dashboard/branch/${slug}?month=${encodeURIComponent(month)}` : `/dashboard/branch/${slug}`

  const linkCls = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
      active
        ? "bg-foreground/[0.06] text-foreground"
        : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
    )

  const onBranchPage = pathname.startsWith("/dashboard/branch/")

  return (
    <nav className="hidden items-center gap-1 md:flex">
      <Link href={withQuery("/dashboard")} className={linkCls(pathname === "/dashboard")}>
        Dashboard
      </Link>
      <Link href={withQuery("/dashboard/finance")} className={linkCls(pathname === "/dashboard/finance")}>
        Finance
      </Link>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(linkCls(onBranchPage), "flex items-center gap-1")}
        >
          Branches
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 flex min-w-40 flex-col rounded-xl border border-foreground/10 bg-background/95 p-1 shadow-lg backdrop-blur-xl">
            {branches.map((b) => (
              <Link
                key={b.slug}
                href={branchHref(b.slug)}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  pathname === `/dashboard/branch/${b.slug}`
                    ? "bg-foreground/[0.06] text-foreground"
                    : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
                )}
              >
                {b.name}
              </Link>
            ))}
            {branches.length === 0 && (
              <span className="px-3 py-1.5 text-xs text-muted-foreground">No branches yet</span>
            )}
          </div>
        )}
      </div>

      {isAdmin && (
        <Link href="/admin" className={linkCls(pathname.startsWith("/admin"))}>
          Admin
        </Link>
      )}
    </nav>
  )
}
