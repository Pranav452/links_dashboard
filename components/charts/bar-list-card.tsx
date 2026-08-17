"use client"

import { useState } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface BarListItem {
  name: string
  value: number
  hint?: string
}

interface BarListCardProps {
  title: string
  subtitle?: string
  data: BarListItem[]
  unit?: string
  live?: boolean
  className?: string
  maxItems?: number
}

export function BarListCard({ title, subtitle, data, unit, live = false, className, maxItems }: BarListCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const items = maxItems ? data.slice(0, maxItems) : data
  const max = Math.max(...items.map((d) => d.value), 1)
  const total = data.reduce((acc, d) => acc + d.value, 0)

  return (
    <Card
      onMouseLeave={() => setHoveredIndex(null)}
      className={cn(
        "group relative gap-5 rounded-2xl border-foreground/[0.06] bg-foreground/[0.02] p-6 shadow-none backdrop-blur-sm transition-all duration-500 hover:border-foreground/[0.1] hover:bg-foreground/[0.04]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {live && <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</span>
        </div>
        {subtitle && <span className="text-xs text-muted-foreground/60">{subtitle}</span>}
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item, index) => {
          const isHovered = hoveredIndex === index
          const isAnyHovered = hoveredIndex !== null
          const share = total > 0 ? Math.round((item.value / total) * 100) : 0

          return (
            <div
              key={item.name}
              className="flex cursor-pointer flex-col gap-1.5"
              onMouseEnter={() => setHoveredIndex(index)}
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={cn(
                    "font-medium transition-colors duration-300",
                    isHovered ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.name}
                </span>
                <span
                  className={cn(
                    "tabular-nums transition-colors duration-300",
                    isHovered ? "text-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {item.value.toLocaleString("en-IN")}
                  {unit && <span className="ml-1 text-muted-foreground/50">{unit}</span>}
                  <span className={cn("ml-2 transition-opacity duration-300", isHovered ? "opacity-100" : "opacity-0")}>
                    {share}%
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    isHovered ? "bg-emerald-500" : isAnyHovered ? "bg-foreground/20" : "bg-foreground/35",
                  )}
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-foreground/[0.02] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    </Card>
  )
}
