"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import type { ProgressStep } from "@/lib/types"

/*
 * The search, drawn. Arcs fan out from the origin to candidate airports while
 * global flight inventory is searched; when fares land they settle on the
 * route being offered. The plane moves along that route as each stage
 * completes, so the map is also the progress bar.
 */

const W = 340
const H = 150
const ORIGIN = { x: 34, y: 112 }
const TARGET = { x: 300, y: 46 }

// Lucide "plane", centred on the origin and turned to face along +x.
const PLANE =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"

type Pose = { x: number[]; y: number[]; rotate: number[] }

/** Keyframes along the route from one progress to the next, so the plane follows the curve. */
function poses(path: SVGPathElement, fromPct: number, toPct: number): Pose {
  const len = path.getTotalLength()
  const out: Pose = { x: [], y: [], rotate: [] }
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    const at = ((fromPct + ((toPct - fromPct) * i) / steps) / 100) * len
    const p = path.getPointAtLength(at)
    const q = path.getPointAtLength(Math.min(len, at + 1))
    out.x.push(p.x)
    out.y.push(p.y)
    out.rotate.push((Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI)
  }
  return out
}

// Candidate airports, placed deterministically (golden-angle spread), never
// Math.random: stable between server and client and between renders.
const CANDIDATES = Array.from({ length: 9 }, (_, i) => {
  const a = (i * 137.508 * Math.PI) / 180
  const r = 0.35 + ((i * 0.618) % 1) * 0.65
  return { x: Math.round(150 + r * 170 * Math.abs(Math.cos(a))), y: Math.round(20 + ((i * 0.381966) % 1) * 104) }
}).filter((p) => Math.hypot(p.x - TARGET.x, p.y - TARGET.y) > 28)

function arc(to: { x: number; y: number }) {
  const mx = (ORIGIN.x + to.x) / 2
  const lift = Math.max(26, Math.abs(to.x - ORIGIN.x) * 0.28)
  const my = Math.min(ORIGIN.y, to.y) - lift
  return `M ${ORIGIN.x} ${ORIGIN.y} Q ${mx} ${my} ${to.x} ${to.y}`
}

const ROUTE = arc(TARGET)

/** How far along the route each stage puts the plane. */
const PROGRESS: Record<ProgressStep, number> = { read: 4, understand: 14, search: 32, compare: 70, choose: 88, verify: 94, book: 96, working: 50 }

export function SearchMap({ from, to, step, count }: { from: string; to: string; step: ProgressStep; count: number | null }) {
  const reduce = useReducedMotion()
  const settled = step !== "search"
  const progress = PROGRESS[step] ?? 50
  const routeRef = useRef<SVGPathElement>(null)
  const [pose, setPose] = useState<{ pose: Pose; key: number } | null>(null)
  const last = useRef(0)

  // Measured from the real path, once per stage.
  useEffect(() => {
    const path = routeRef.current
    if (!path) return
    const from = reduce ? progress : last.current
    last.current = progress
    const next = poses(path, from, progress)
    const id = requestAnimationFrame(() => setPose((p) => ({ pose: next, key: (p?.key ?? 0) + 1 })))
    return () => cancelAnimationFrame(id)
  }, [progress, reduce])

  return (
    <div className="relative mt-4 overflow-hidden rounded-xl bg-background/60" aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
        <defs>
          <linearGradient id="route-grad" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0%" stopColor="var(--pal)" />
            <stop offset="100%" stopColor="var(--flyte)" />
          </linearGradient>
          <pattern id="map-dots" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="var(--dot)" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#map-dots)" />

        {/* The fan: every candidate route searched. */}
        {CANDIDATES.map((p, i) => (
          <g key={i}>
            <motion.path
              d={arc(p)}
              fill="none"
              stroke="var(--pal)"
              strokeWidth={1.2}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: settled ? 0.08 : 0.35 }}
              transition={{
                pathLength: { duration: reduce ? 0 : 0.9, delay: reduce ? 0 : 0.1 + i * 0.12, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.5, delay: settled ? 0 : i * 0.12 },
              }}
            />
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={2.4}
              fill="var(--pal)"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: settled ? 0.2 : 0.75 }}
              transition={{ delay: reduce ? 0 : 0.6 + i * 0.12, duration: 0.3 }}
              style={{ transformOrigin: `${p.x}px ${p.y}px` }}
            />
          </g>
        ))}

        {/* The route being offered. */}
        <path ref={routeRef} d={ROUTE} fill="none" stroke="var(--border)" strokeWidth={1.5} strokeDasharray="3 5" />
        <motion.path
          d={ROUTE}
          fill="none"
          stroke="url(#route-grad)"
          strokeWidth={2.6}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: progress / 100 }}
          transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        />

        {[ORIGIN, TARGET].map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={9} fill="var(--pal)" opacity={0.14} />
            <circle cx={p.x} cy={p.y} r={4} fill="var(--card)" stroke="var(--pal)" strokeWidth={2.2} />
          </g>
        ))}
        <text x={ORIGIN.x - 10} y={ORIGIN.y + 26} className="fill-foreground font-mono text-[13px] font-semibold tracking-wider">
          {from}
        </text>
        <text x={TARGET.x - 14} y={TARGET.y - 16} className="fill-foreground font-mono text-[13px] font-semibold tracking-wider">
          {to}
        </text>

        {pose && (
          <motion.g
            key={pose.key}
            initial={{ x: pose.pose.x[0], y: pose.pose.y[0], rotate: pose.pose.rotate[0] }}
            animate={{ x: pose.pose.x, y: pose.pose.y, rotate: pose.pose.rotate }}
            transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <g transform="rotate(45) translate(-12 -12) scale(1)">
              <path d={PLANE} fill="var(--pal)" stroke="var(--card)" strokeWidth={1.2} strokeLinejoin="round" />
            </g>
          </motion.g>
        )}
      </svg>

      {count !== null && (
        <motion.span
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-2 bottom-2 rounded-full bg-card/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-pal-text shadow-sm"
        >
          {count} fares
        </motion.span>
      )}
    </div>
  )
}
