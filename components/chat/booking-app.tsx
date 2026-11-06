"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, ArrowUpRight, RotateCcw, UserRound } from "lucide-react"
import { SiteHeader, PoweredByFlyte } from "@/components/site-header"
import { useAuth } from "@/components/auth"
import { useConversation } from "@/lib/use-conversation"
import type { FlightOffer } from "@/lib/types"
import { Composer } from "@/components/chat/composer"
import { Message } from "@/components/chat/message"
import { StageProgress } from "@/components/chat/stage-progress"
import { VoiceStage } from "@/components/voice/voice-stage"
import { VoiceDock } from "@/components/voice/voice-dock"
import { prepareVoice, replySkipped, setUtteranceHandler, speakReply, startVoice, voiceActive, voiceTurnStarted } from "@/lib/voice/voice"
import { Button } from "@/components/ui/button"

const EASE = [0.22, 1, 0.36, 1] as const

const SUGGESTIONS = [
  "Dubai, last week of December, under $900",
  "Lisbon in March for five nights",
  "One way to Tokyo next month",
]

export function BookingApp() {
  const auth = useAuth()
  const convo = useConversation()
  const { messages, busy, liveStages, send, stop, reset, onReply, conversationId } = convo
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const [focusSignal, setFocusSignal] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const canChat = auth.status === "signed-in"

  // Voice and typing share this one conversation: a spoken sentence goes
  // through the same send(), and every reply is spoken while voice is on.
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  }, [send])
  useEffect(() => {
    void prepareVoice().then((a) => setVoiceNote(a.note))
    setUtteranceHandler((text) => void sendRef.current(text, { via: "voice" }))
    const off = onReply((m) => {
      if (voiceActive()) void speakReply(m.content, m.error ? null : m.reply)
    })
    return () => {
      off()
      setUtteranceHandler(null)
    }
  }, [onReply])
  // A turn that ended with nothing to say (stopped): listen again.
  useEffect(() => {
    if (!busy) replySkipped()
  }, [busy])

  // Keep the newest turn in view.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const id = requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }))
    return () => cancelAnimationFrame(id)
  }, [messages.length, liveStages.length, busy])

  // The offer a payment belongs to: the latest one shown before it.
  const offers = useMemo(() => {
    const map = new Map<string, FlightOffer | null>()
    let current: FlightOffer | null = null
    for (const m of messages) {
      if (m.reply?.offer) current = m.reply.offer
      map.set(m.id, current)
    }
    return map
  }, [messages])

  const sendText = useCallback(
    (text: string) => {
      voiceTurnStarted()
      void send(text, { via: "text" })
    },
    [send],
  )
  const empty = messages.length === 0

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <div aria-hidden className="glow-field pointer-events-none fixed inset-0 -z-10 opacity-70" />
      <SiteHeader className="shrink-0 border-b border-hairline bg-background/70 backdrop-blur-md" />

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pt-6 pb-6 sm:px-6">
          {empty ? (
            <EmptyState auth={auth} onPick={sendText} />
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((m, i) => (
                <Message
                  key={m.id}
                  message={m}
                  latest={i === messages.length - 1 && !busy}
                  conversationId={conversationId}
                  offer={offers.get(m.id) ?? null}
                  travellerName={auth.name}
                  onSend={sendText}
                />
              ))}
              <AnimatePresence>{busy && <StageProgress key="progress" stages={liveStages} />}</AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-hairline bg-background/70 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <VoiceDock stages={liveStages} />
          <Composer
            busy={busy}
            disabled={!canChat}
            onSend={sendText}
            onStop={stop}
            onVoice={() => canChat && void startVoice()}
            voiceDisabled={!canChat}
            focusSignal={focusSignal}
          />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <PoweredByFlyte className="border-0 bg-transparent px-0 py-0" />
            {!empty && (
              <button
                onClick={() => {
                  reset()
                  setFocusSignal((n) => n + 1)
                }}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="size-3.5" /> New trip
              </button>
            )}
          </div>
        </div>
      </div>

      <VoiceStage stages={liveStages} note={voiceNote} />
    </div>
  )
}

function EmptyState({ auth, onPick }: { auth: ReturnType<typeof useAuth>; onPick: (text: string) => void }) {
  const { status, error } = auth
  return (
    <div className="my-auto py-8">
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="font-mono text-xs tracking-[0.2em] text-pal-text uppercase"
      >
        Flyte AI agent
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
        className="mt-3 text-[clamp(2.2rem,6vw,3.4rem)] leading-[1.02] font-semibold tracking-[-0.04em]"
      >
        Where to?
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
        className="mt-3 max-w-md text-muted-foreground"
      >
        Tell me the trip in your own words. I&apos;ll find the best fare and you&apos;ll pay with PayPal.
      </motion.p>

      <div className="mt-8">
        {status === "signed-in" && (
          <motion.ul
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } } }}
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          >
            {SUGGESTIONS.map((s) => (
              <motion.li key={s} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
                <button
                  onClick={() => onPick(s)}
                  className="group inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-hairline bg-card px-4 text-left text-sm transition-[border-color,transform] duration-200 hover:border-pal/40 active:scale-[0.98] sm:w-auto"
                >
                  {s}
                  <ArrowUpRight className="size-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-pal-text" />
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}

        {(status === "signed-out" || status === "error" || status === "connecting") && (
          <Gate
            title="Try it in one click"
            body="Continue as our demo traveller: no account needed. It's one shared account, so other people trying Flyte Pal can see its chats and trips. Bookings are simulated and payments run in PayPal's sandbox."
            error={status === "error" ? error : null}
            action={
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  onClick={() => void auth.continueAsDemo()}
                  disabled={status === "connecting"}
                  className="group h-12 rounded-full bg-pal px-6 text-base text-white shadow-[0_12px_30px_-14px_var(--pal)] hover:bg-pal/90"
                >
                  <UserRound /> Continue as demo traveller
                  <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </div>
            }
          />
        )}

        {status === "loading" && <div className="h-12 w-64 animate-pulse rounded-full bg-muted" />}
      </div>
    </div>
  )
}

function Gate({ title, body, action, error }: { title: string; body: string; action?: React.ReactNode; error?: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
      className="float-card max-w-md rounded-3xl p-6"
    >
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}
