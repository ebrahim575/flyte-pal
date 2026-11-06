"use client"

import { useEffect, useRef } from "react"
import { interrupt, speechLevel, type VoiceStatus } from "@/lib/voice/voice"
import { useReducedMotionPreference } from "@/lib/use-reduced-motion"
import { cn } from "@/lib/utils"
import styles from "./voice.module.css"

export const STATUS_LABEL: Record<VoiceStatus, string> = {
  off: "Voice off",
  connecting: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
}

/**
 * The orb. Breathes while it listens, swirls while it thinks, swells with the
 * voice while it speaks. Tap it then to cut in.
 */
export function VoiceOrb({ status, size = 44, className }: { status: VoiceStatus; size?: number; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotionPreference()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (status !== "speaking" || reduce) {
      el.style.setProperty("--level", "0")
      return
    }
    let raf = 0
    let smooth = 0
    const tick = () => {
      smooth += (speechLevel() - smooth) * 0.3
      el.style.setProperty("--level", smooth.toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status, reduce])

  const speaking = status === "speaking"
  return (
    <button
      ref={ref}
      type="button"
      data-status={status}
      onClick={interrupt}
      aria-label={speaking ? "Tap to cut in" : STATUS_LABEL[status]}
      className={cn(styles.orb, speaking ? "cursor-pointer" : "cursor-default", className)}
      style={{ ["--orb-size" as string]: `${size}px` }}
    >
      <span className={styles.aura} aria-hidden />
      {[0, 0.8, 1.6].map((delay) => (
        <span key={delay} className={styles.ring} style={{ animationDelay: `${delay}s` }} aria-hidden />
      ))}
      <span className={styles.body} aria-hidden>
        <span className={styles.core}>
          <span className={styles.swirl} />
          <span className={styles.sheen} />
        </span>
      </span>
    </button>
  )
}

export function ThinkingDots() {
  return (
    <span className={styles.dots} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  )
}

export const stageGlowClass = styles.glow
