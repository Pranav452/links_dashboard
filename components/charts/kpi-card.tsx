"use client"

import { useState } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface KpiCardProps {
  label: string
  value: string
  unit?: string
  sub?: string
  icon?: React.ReactNode
  spark?: number[]
  accent?: boolean
  className?: string
}

export function KpiCard({ label, value, unit, sub, icon, spark, accent, className }: KpiCardProps) {
  const [hovered, setHovered] = useState(false)
  const max = spark && spark.length ? Math.max(...spark, 1) : 1

  return (
    <Card
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative gap-3 rounded-2xl border-foreground/[0.06] bg-foreground/[0.02] p-5 shadow-none backdrop-blur-sm transition-all duration-500 hover:border-foreground/[0.1] hover:bg-foreground/[0.04]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full", accent ? "animate-pulse bg-emerald-500" : "bg-foreground/20")} />
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        </div>
        {icon && (
          <span className="text-muted-foreground/50 transition-colors duration-300 group-hover:text-foreground [&_svg]:h-4 [&_svg]:w-4">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}
      </div>

      <div className="flex items-end justify-between gap-4">
        {sub && <span className="text-xs leading-relaxed text-muted-foreground/70">{sub}</span>}
        {spark && spark.length > 0 && (
          <div className="ml-auto flex h-8 items-end gap-[3px]">
            {spark.map((v, i) => (
              <div
                key={i}
                className={cn(
                  "w-[4px] rounded-full transition-all duration-300",
                  hovered ? "bg-foreground/40" : "bg-foreground/20",
                  i === spark.length - 1 && "bg-emerald-500",
                )}
                style={{ height: `${Math.max((v / max) * 32, 3)}px` }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-foreground/[0.02] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    </Card>
  )
}
