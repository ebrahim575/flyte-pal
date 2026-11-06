"use client"

import { useEffect, useRef } from "react"
import { animate, useReducedMotion } from "motion/react"

/** Counts to `value` by writing textContent, never React state per frame. */
export function CountUp({ value, format, duration = 0.9, delay = 0 }: { value: number; format: (n: number) => string; duration?: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = format(value)
      return
    }
    const controls = animate(0, value, {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => {
        el.textContent = format(n)
      },
    })
    return () => controls.stop()
  }, [value, format, duration, delay, reduce])
  return (
    <span ref={ref} className="tabular-nums">
      {format(value)}
    </span>
  )
}
