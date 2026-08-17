"use client"

import { useState } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface BarPoint {
  label: string
  value: number
  hint?: string
  muted?: boolean
}

interface BarChartCardProps {
  title: string
  subtitle?: string
  data: BarPoint[]
  unit?: string
  height?: number
  showEveryLabel?: number
  live?: boolean
  className?: string
  footer?: React.ReactNode
}

export function BarChartCard({
  title,
  subtitle,
  data,
  unit,
  height = 128,
  showEveryLabel = 1,
  live = true,
  className,
  footer,
}: BarChartCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [displayIndex, setDisplayIndex] = useState<number | null>(null)
  const [isHovering, setIsHovering] = useState(false)
  const maxValue = Math.max(...data.map((d) => d.value), 1)

  const handleEnter = (index: number) => {
    setHoveredIndex(index)
    setDisplayIndex(index)
  }

  const handleLeave = () => {
    setIsHovering(false)
    setHoveredIndex(null)
    setTimeout(() => setDisplayIndex(null), 150)
  }

  const display = displayIndex !== null ? data[displayIndex] : null

  return (
    <Card
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleLeave}
      className={cn(
        "group relative gap-4 rounded-2xl border-foreground/[0.06] bg-foreground/[0.02] p-6 shadow-none backdrop-blur-sm transition-all duration-500 hover:border-foreground/[0.1] hover:bg-foreground/[0.04]",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {live && <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</span>
          </div>
          {subtitle && <span className="text-xs text-muted-foreground/60">{subtitle}</span>}
        </div>
        <div className="relative flex h-7 items-center">
          <span
            className={cn(
              "text-lg font-semibold tabular-nums transition-all duration-300 ease-out",
              isHovering && display !== null ? "text-foreground opacity-100" : "text-muted-foreground opacity-50",
            )}
          >
            {display !== null ? display.value : ""}
            <span
              className={cn(
                "ml-1 text-xs font-normal text-muted-foreground transition-opacity duration-300",
                display !== null ? "opacity-100" : "opacity-0",
              )}
            >
              {unit}
            </span>
          </span>
        </div>
      </div>

      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((item, index) => {
          const heightPx = Math.max((item.value / maxValue) * height, item.value > 0 ? 4 : 2)
          const isHovered = hoveredIndex === index
          const isAnyHovered = hoveredIndex !== null
          const isNeighbor = hoveredIndex !== null && (index === hoveredIndex - 1 || index === hoveredIndex + 1)

          return (
            <div
              key={`${item.label}-${index}`}
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              onMouseEnter={() => handleEnter(index)}
            >
              <div
                className={cn(
                  "mx-auto w-full max-w-9 cursor-pointer rounded-full transition-all duration-300 ease-out origin-bottom",
                  item.muted
                    ? isHovered
                      ? "bg-emerald-500"
                      : isAnyHovered
                        ? "bg-foreground/[0.06]"
                        : "bg-foreground/10 group-hover:bg-foreground/[0.12]"
                    : isHovered
                      ? "bg-emerald-400"
                      : isNeighbor
                        ? "bg-foreground/40"
                        : isAnyHovered
                          ? "bg-foreground/15"
                          : "bg-foreground/30 group-hover:bg-foreground/35",
                )}
                style={{
                  height: `${heightPx}px`,
                  transform: isHovered ? "scaleX(1.2)" : isNeighbor ? "scaleX(1.08)" : "scaleX(1)",
                }}
              />
              <span
                className={cn(
                  "mt-2 h-3 w-full overflow-hidden text-center text-[9px] font-medium whitespace-nowrap transition-all duration-300",
                  isHovered ? "text-foreground" : "text-muted-foreground/50",
                  index % showEveryLabel !== 0 && !isHovered && "opacity-0",
                )}
              >
                {item.label}
              </span>

              <div
                className={cn(
                  "absolute -top-9 left-1/2 z-10 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background transition-all duration-200",
                  isHovered ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0",
                )}
              >
                {item.hint ?? `${item.label} · ${item.value}${unit ? ` ${unit}` : ""}`}
              </div>
            </div>
          )
        })}
      </div>

      {footer}

      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-foreground/[0.02] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    </Card>
  )
}
