"use client"

import { AnimatePresence, motion } from "motion/react"
import { Maximize2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { endVoice, setStage, useVoice } from "@/lib/voice/voice"
import type { Progress } from "@/lib/types"
import { STATUS_LABEL, ThinkingDots, VoiceOrb } from "./voice-orb"
import { thinkingLabel } from "./voice-stage"

const EASE = [0.22, 1, 0.36, 1] as const

/** Above the composer while voice is on and the stage is minimised. Typing still works. */
export function VoiceDock({ stages }: { stages: Progress[] }) {
  const v = useVoice()
  const show = v.status !== "off" && !v.stage
  const hearing = v.status === "listening" && !!v.partial
  const line =
    v.status === "connecting"
      ? STATUS_LABEL.connecting
      : v.status === "listening"
        ? v.partial || "Listening. Just talk."
        : v.status === "thinking"
          ? thinkingLabel(stages)
          : v.context?.payment
            ? "Tap the PayPal button to pay"
            : "Speaking. Talk over it to cut in."

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="dock"
          data-testid="voice-dock"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <div className="float-card mb-2.5 flex items-center gap-3 rounded-2xl py-1.5 pr-1.5 pl-3">
            <VoiceOrb status={v.status} size={36} />
            <div className="min-w-0 flex-1" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={v.status + (hearing ? ":hearing" : "")}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className={`line-clamp-2 text-sm leading-snug ${hearing ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {line}
                  {(v.status === "thinking" || v.status === "connecting") && <ThinkingDots />}
                </motion.p>
              </AnimatePresence>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setStage(true)} aria-label="Open voice mode" className="size-10 rounded-full text-muted-foreground">
              <Maximize2 className="size-[18px]" />
            </Button>
            <Button variant="ghost" size="icon" onClick={endVoice} aria-label="End voice" className="size-10 rounded-full text-muted-foreground">
              <X className="size-[18px]" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
