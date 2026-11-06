"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog } from "radix-ui"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, CreditCard, Keyboard, MicOff, Minimize2, Plane, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/site-header"
import { closeStage, endVoice, setStage, speechClock, startVoice, useVoice } from "@/lib/voice/voice"
import type { SpokenWord } from "@/lib/voice/speech-player"
import { phrasesOf } from "@/lib/voice/phrases"
import type { Progress } from "@/lib/types"
import { searchRoute, stageLabel } from "@/lib/stages"
import { STATUS_LABEL, ThinkingDots, VoiceOrb, stageGlowClass } from "./voice-orb"

const EASE = [0.22, 1, 0.36, 1] as const

const PROMPTS = ["Dubai, last week of December, under $900", "Lisbon in March for five nights", "One way to Tokyo next month"]

const bare = (s: string) => s.toLowerCase().replace(/[^a-z0-9$]/g, "")
const isMoney = (w: string) => /[$€£]\d/.test(w)

/** The index of the word coming out of the speaker now. One rAF loop, a render only when it moves. */
function useSpokenIndex(words: SpokenWord[], running: boolean): number {
  const [idx, setIdx] = useState(-1)
  useEffect(() => {
    if (!running || !words.length) return
    let raf = 0
    let last = -2
    const tick = () => {
      const t = speechClock()
      let i = -1
      // A hair early reads as in sync; exactly on time reads as late.
      while (i + 1 < words.length && words[i + 1].start <= t + 0.06) i++
      if (i !== last) {
        last = i
        setIdx(i)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [words, running])
  return running ? idx : -1
}

/** What the agent is doing, in the same words as the chat's progress card. */
export function thinkingLabel(stages: Progress[]): string {
  const last = stages[stages.length - 1]
  return last ? stageLabel(last) : STATUS_LABEL.thinking
}

export function VoiceStage({ stages, note }: { stages: Progress[]; note: string | null }) {
  const v = useVoice()
  const open = v.stage
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeStage()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount key="stage">
            <StageView stages={stages} note={note} />
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

function StageView({ stages, note }: { stages: Progress[]; note: string | null }) {
  const v = useVoice()
  const speaking = v.status === "speaking"
  const idx = useSpokenIndex(v.words, speaking)
  const phrases = useMemo(() => phrasesOf(v.words), [v.words])
  const phraseAt = Math.max(0, phrases.findIndex((p) => p.includes(Math.max(idx, 0))))
  const phrase = phrases[phraseAt] ?? []
  const route = searchRoute(stages)

  // The fare card pops in when the voice says the price.
  const ctx = v.context
  const cityWord = ctx?.toCity ? bare(ctx.toCity.split(/[\s,]/)[0]) : ""
  const moneyAt = v.words.findIndex((w) => isMoney(w.text))
  const showFare = !!ctx?.price && speaking && moneyAt >= 0 && idx >= moneyAt
  const showPay = !!ctx?.payment && speaking && idx >= 2
  const failed = v.status === "off" && !!v.error

  return (
    <Dialog.Content forceMount asChild aria-describedby={undefined}>
      <motion.div
        data-testid="voice-stage"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background text-foreground"
      >
        <Dialog.Title className="sr-only">Voice mode</Dialog.Title>
        <div className={stageGlowClass} aria-hidden />

        <div className="relative flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-hairline bg-surface px-3 text-xs font-medium">
            <span className={`size-2 rounded-full ${failed ? "bg-muted-foreground" : v.status === "listening" ? "bg-success" : "bg-pal"}`} />
            {failed ? "Voice unavailable" : STATUS_LABEL[v.status]}
          </span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setStage(false)} aria-label="Back to the chat" className="size-10 rounded-full" disabled={failed}>
              <Minimize2 className="size-[18px]" />
            </Button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-5 sm:px-10">
          {/* Fixed-height media row so the words never jump. */}
          <div className="flex h-24 items-end justify-center sm:h-32">
            <AnimatePresence>
              {showFare && ctx && (
                <motion.div
                  key="fare"
                  data-testid="voice-fare"
                  initial={{ opacity: 0, scale: 0.7, y: 16, rotate: -3 }}
                  animate={{ opacity: 1, scale: 1, y: 0, rotate: -1.5 }}
                  exit={{ opacity: 0, scale: 0.9, y: -8 }}
                  transition={{ type: "spring", stiffness: 380, damping: 20 }}
                  className="float-card flex items-center gap-4 rounded-2xl px-5 py-3"
                >
                  <span className="flex items-center gap-2 font-mono text-xl font-semibold tracking-wider">
                    {ctx.from} <Plane className="size-4 rotate-45 text-pal" fill="currentColor" /> {ctx.to}
                  </span>
                  <span className="h-8 w-px bg-border" />
                  <span className="text-2xl font-semibold tracking-tight text-pal-text">{ctx.price}</span>
                </motion.div>
              )}
              {showPay && (
                <motion.div
                  key="pay"
                  initial={{ opacity: 0, scale: 0.8, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  className="float-card flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                >
                  <CreditCard className="size-4 text-pal-text" /> Tap the PayPal button to pay
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex min-h-[40svh] w-full items-center justify-center py-6">
            <AnimatePresence mode="popLayout" initial={false}>
              {failed ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="flex max-w-md flex-col items-center text-center"
                >
                  <span className="grid size-12 place-items-center rounded-full bg-muted">
                    <MicOff className="size-5" />
                  </span>
                  <p className="mt-4 text-xl font-semibold tracking-tight">Voice isn&apos;t available</p>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{v.error}</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Button onClick={closeStage} className="h-11 rounded-full px-5">
                      <Keyboard /> Keep typing
                    </Button>
                    <Button variant="ghost" onClick={() => void startVoice()} className="h-11 rounded-full px-5">
                      <RotateCcw /> Try again
                    </Button>
                  </div>
                </motion.div>
              ) : speaking && phrase.length > 0 ? (
                <motion.p
                  key={`${v.replyId}:${phraseAt}`}
                  exit={{ opacity: 0, y: -24, transition: { duration: 0.2, ease: EASE } }}
                  className="max-w-[17ch] text-center text-[clamp(2.2rem,7.5vw,5.6rem)] leading-[1.04] font-semibold tracking-[-0.035em]"
                  aria-hidden
                >
                  {phrase.map((i) => {
                    const w = v.words[i]
                    const said = i <= idx
                    const accent = /\d/.test(w.text) || (cityWord !== "" && bare(w.text) === cityWord)
                    return (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, y: "0.3em", scale: 0.96 }}
                        animate={said ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0.12, y: "0.3em", scale: 0.96 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className={`inline-block whitespace-pre ${accent ? "text-pal-text" : ""}`}
                      >
                        {w.text}{" "}
                      </motion.span>
                    )
                  })}
                </motion.p>
              ) : v.status === "listening" ? (
                <motion.div
                  key="listening"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="flex flex-col items-center text-center"
                >
                  {v.partial ? (
                    <p data-testid="voice-partial" className="max-w-[20ch] text-[clamp(1.9rem,6vw,4.4rem)] leading-[1.08] font-semibold tracking-[-0.03em]">
                      {/* Each word fades in as it is recognised; earlier words keep their place. */}
                      {v.partial.split(/\s+/).filter(Boolean).map((w, i) => (
                        <motion.span
                          key={i}
                          initial={{ opacity: 0, y: "0.25em" }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28, ease: EASE }}
                          className="inline-block whitespace-pre"
                        >
                          {w}{" "}
                        </motion.span>
                      ))}
                      <span className="loop-caret ml-1 inline-block h-[0.8em] w-[3px] translate-y-[0.08em] rounded-full bg-pal" />
                    </p>
                  ) : (
                    <>
                      <p className="text-[clamp(2.4rem,8vw,5.6rem)] leading-none font-semibold tracking-[-0.045em] text-muted-foreground">Where to?</p>
                      <p className="mt-5 text-sm text-muted-foreground">Just talk. For example:</p>
                      <ul className="mt-3 flex max-w-xl flex-wrap justify-center gap-2">
                        {PROMPTS.map((p) => (
                          <li key={p} className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-sm">
                            &ldquo;{p}&rdquo;
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="flex flex-col items-center text-center"
                >
                  {v.heard && <p className="mb-5 max-w-lg text-lg text-muted-foreground sm:text-xl">&ldquo;{v.heard}&rdquo;</p>}
                  <p className="max-w-[18ch] text-[clamp(1.8rem,5.5vw,3.6rem)] leading-[1.08] font-semibold tracking-[-0.03em]">
                    {v.status === "connecting" ? "Getting the microphone ready" : thinkingLabel(stages)}
                    <ThinkingDots />
                  </p>
                  {v.status === "thinking" && route && (
                    <p className="mt-4 inline-flex items-center gap-2 font-mono text-sm font-semibold tracking-wider text-muted-foreground">
                      {route.from} <ArrowRight className="size-3.5" /> {route.to}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <p className="sr-only" aria-live="polite">
              {speaking ? v.words.map((w) => w.text).join(" ") : v.status === "listening" ? v.partial : ""}
            </p>
          </div>
        </div>

        <div className="relative flex shrink-0 flex-col items-center gap-4 px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {!failed && <VoiceOrb status={v.status} size={88} />}
          {!failed && (
            <p className="text-sm text-muted-foreground">
              {speaking ? "Talk over it, or tap the orb, to cut in" : v.status === "listening" ? "Listening. Pause when you're done." : " "}
            </p>
          )}
          {note && !failed && <p className="max-w-sm text-center text-xs text-muted-foreground">{note}</p>}
          {!failed && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setStage(false)} className="h-10 rounded-full px-4">
                <Keyboard /> Type instead
              </Button>
              <Button variant="ghost" onClick={endVoice} className="h-10 rounded-full px-4 text-muted-foreground">
                <X /> End voice
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </Dialog.Content>
  )
}
