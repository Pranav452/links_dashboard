"use client"

import { useState } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface DonutSegment {
  name: string
  value: number
  hint?: string
}

interface DonutCardProps {
  title: string
  subtitle?: string
  data: DonutSegment[]
  unit?: string
  centerLabel?: string
  className?: string
}

// Monochrome ramp with the top segment in emerald — keeps the single-accent
// design language of the rest of the dashboard.
const SEGMENT_OPACITY = [1, 0.55, 0.35, 0.22, 0.14, 0.08]

export function DonutCard({ title, subtitle, data, unit, centerLabel, className }: DonutCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const total = data.reduce((acc, d) => acc + d.value, 0)

  const size = 180
  const stroke = 20
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r

  let offset = 0
  const segments = data.map((d, i) => {
    const fraction = total > 0 ? d.value / total : 0
    const seg = { ...d, index: i, fraction, start: offset }
    offset += fraction
    return seg
  })

  const active = hoveredIndex !== null ? data[hoveredIndex] : null

  return (
    <Card
      onMouseLeave={() => setHoveredIndex(null)}
      className={cn(
        "group relative gap-5 rounded-2xl border-foreground/[0.06] bg-foreground/[0.02] p-6 shadow-none backdrop-blur-sm transition-all duration-500 hover:border-foreground/[0.1] hover:bg-foreground/[0.04]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</span>
        {subtitle && <span className="text-xs text-muted-foreground/60">{subtitle}</span>}
      </div>

      <div className="flex items-center justify-center gap-8">
        <div className="relative">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            {segments.map((seg) => (
              <circle
                key={seg.name}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={hoveredIndex === seg.index ? stroke + 4 : stroke}
                strokeDasharray={`${Math.max(seg.fraction * circumference - 3, 0)} ${circumference}`}
                strokeDashoffset={-seg.start * circumference}
                strokeLinecap="round"
                onMouseEnter={() => setHoveredIndex(seg.index)}
                className={cn(
                  "cursor-pointer transition-all duration-300",
                  seg.index === 0 ? "stroke-emerald-500" : "stroke-foreground",
                )}
                style={{
                  opacity:
                    hoveredIndex === null
                      ? seg.index === 0
                        ? 0.9
                        : SEGMENT_OPACITY[Math.min(seg.index, SEGMENT_OPACITY.length - 1)]
                      : hoveredIndex === seg.index
                        ? 1
                        : 0.1,
                }}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums">
              {(active ? active.value : total).toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
              {active ? active.name : (centerLabel ?? unit)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {segments.map((seg) => (
            <div
              key={seg.name}
              className="flex cursor-pointer items-center gap-2.5"
              onMouseEnter={() => setHoveredIndex(seg.index)}
            >
              <div
                className={cn("h-2 w-2 rounded-full", seg.index === 0 ? "bg-emerald-500" : "bg-foreground")}
                style={{
                  opacity:
                    seg.index === 0 ? 1 : SEGMENT_OPACITY[Math.min(seg.index, SEGMENT_OPACITY.length - 1)] + 0.1,
                }}
              />
              <span
                className={cn(
                  "text-xs font-medium transition-colors duration-300",
                  hoveredIndex === seg.index ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {seg.name}
              </span>
              <span className="ml-auto pl-3 text-xs tabular-nums text-muted-foreground/60">
                {Math.round(seg.fraction * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-foreground/[0.02] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    </Card>
  )
}
