"use client"

import { motion, useReducedMotion } from "motion/react"
import { Plane } from "lucide-react"

/*
 * The checkout's motion, in PayPal's blues (navy into bright blue) so the
 * payment moments read as "PayPal is handling this now". Only gradients,
 * outlines and a check: never PayPal's marks. Their own buttons come from
 * their SDK untouched.
 */

const EASE = [0.22, 1, 0.36, 1] as const

/** A navy-to-blue wave that sweeps across the card once as checkout opens. */
export function PayPalWave() {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -left-1/2 z-10 w-[200%]"
      style={{ background: "var(--pp-wave)" }}
      initial={{ x: "-55%", opacity: 0 }}
      animate={{ x: "55%", opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1.25, ease: [0.45, 0, 0.25, 1], delay: 0.25, times: [0, 0.2, 0.75, 1] }}
    />
  )
}

/** A shield outline that draws in, then a lock settles inside it. Quick and quiet. */
export function ShieldDraw({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path
        d="M12 2.8 4.5 5.6v5.9c0 4.6 3.1 8.4 7.5 9.7 4.4-1.3 7.5-5.1 7.5-9.7V5.6L12 2.8Z"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.35 }}
      />
      <motion.g initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.95 }}>
        <rect x="9" y="10.6" width="6" height="4.9" rx="1" />
        <path d="M10.3 10.6V9.3a1.7 1.7 0 0 1 3.4 0v1.3" />
      </motion.g>
    </svg>
  )
}

/** Payment captured: a blue check draws itself and a ripple goes out. */
export function CheckBurst({ size = 44 }: { size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} aria-hidden>
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-pp-blue"
        initial={{ scale: 0.6, opacity: 0.9 }}
        animate={{ scale: 2.1, opacity: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
      />
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: "linear-gradient(135deg, var(--pp-navy), var(--pp-blue) 60%, var(--pp-sky))" }}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 480, damping: 22 }}
      />
      <svg viewBox="0 0 24 24" className="relative size-1/2 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, ease: EASE, delay: 0.2 }} />
      </svg>
    </span>
  )
}

/** The plane taxis while the booking goes through, then takes off. */
export function Runway({ phase }: { phase: "taxi" | "takeoff" }) {
  return (
    <div data-phase={phase} className="runway mt-3 h-14 rounded-xl bg-background/60" aria-hidden>
      <div className="runway-lights absolute inset-x-0 bottom-[9px] flex gap-[14px] overflow-hidden px-2">
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i} className="h-[2px] w-[14px] shrink-0 rounded-full bg-pp-blue/35" />
        ))}
      </div>
      <span className="runway-plane text-pp-blue">
        <Plane className="size-6 rotate-45" fill="currentColor" strokeWidth={1.2} />
      </span>
    </div>
  )
}
