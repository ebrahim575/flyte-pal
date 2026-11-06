"use client"

import { AnimatePresence, motion } from "motion/react"
import { Check, Sparkles } from "lucide-react"
import { SearchMap } from "@/components/chat/search-map"
import type { Progress } from "@/lib/types"
import { searchRoute, stageDetail, stageLabel } from "@/lib/stages"

const EASE = [0.22, 1, 0.36, 1] as const

/** Collapse consecutive repeats so "routed, routing, routed" shows once. */
function distinct(stages: Progress[]) {
  const out: Progress[] = []
  for (const s of stages) {
    const last = out[out.length - 1]
    if (last && stageLabel(last) === stageLabel(s)) out[out.length - 1] = s
    else out.push(s)
  }
  return out
}

export function StageProgress({ stages }: { stages: Progress[] }) {
  const list = distinct(stages)
  const route = searchRoute(stages)
  const found = stages.find((s) => s.step === "compare")

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
      transition={{ duration: 0.4, ease: EASE }}
      className="float-card w-full max-w-md rounded-2xl p-4"
      role="status"
      aria-live="polite"
    >
      {list.length === 0 && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Dots />
          Thinking
        </div>
      )}
      <ol className="space-y-2.5">
        <AnimatePresence initial={false}>
          {list.map((stage, i) => {
            const current = i === list.length - 1
            const detail = stageDetail(stage)
            return (
              <motion.li
                key={`${stage.step}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="flex items-start gap-3"
              >
                <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
                  {current ? (
                    <>
                      <span className="loop-pulse absolute inset-0 rounded-full bg-pal/40" />
                      <span className="relative size-2.5 rounded-full bg-pal" />
                    </>
                  ) : (
                    <motion.span
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 26 }}
                      className="grid size-5 place-items-center rounded-full bg-success/15 text-success"
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </motion.span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className={current ? "loop-shimmer relative block overflow-hidden text-sm font-medium" : "block text-sm text-muted-foreground"}>
                    {stageLabel(stage)}
                  </span>
                  {detail && <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{detail}</span>}
                </span>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>
      {route && (
        <SearchMap
          from={route.from}
          to={route.to}
          step={list[list.length - 1]?.step ?? "search"}
          count={typeof found?.count === "number" ? found.count : null}
        />
      )}
    </motion.div>
  )
}

function Dots() {
  return (
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-pal"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  )
}

/** After the turn: one quiet line saying what the agent did. */
export function StageTrail({ stages }: { stages?: Progress[] }) {
  if (!stages?.length) return null
  const found = stages.find((s) => s.step === "compare")
  const count = typeof found?.count === "number" ? found.count : null
  const seconds = stages.length > 1 ? (stages[stages.length - 1].at - stages[0].at) / 1000 : 0
  const label = count ? `Compared ${count} fares` : stages.some((s) => s.step === "verify") ? "Checked the fare is still live" : null
  if (!label) return null
  return (
    <p className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Sparkles className="size-3.5 text-flyte-text" />
      {label}
      {seconds > 1 && <span className="font-mono">· {seconds.toFixed(1)}s</span>}
    </p>
  )
}
