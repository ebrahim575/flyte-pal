"use client"

/*
 * Voice mode: talk to the Flyte AI agent and hear it answer, in the same
 * conversation as typing.
 *
 *   listening --you stop talking--> thinking --reply--> speaking --done--> listening
 *                                                   \--you talk over it--> listening
 *
 * A finished sentence goes into the chat's send(), exactly like a typed
 * message, so voice can do only what typing can. Paying always needs a tap on
 * the PayPal button.
 *
 * Barge-in: the microphone stays open while the agent speaks (with echo
 * cancellation). Anything heard then that is mostly the reply's own words is
 * treated as echo and ignored; real words from the traveller stop the voice
 * and become the next turn.
 */

import { useSyncExternalStore } from "react"
import type { SpokenWord } from "@/lib/voice/speech-player"
import { spokenReply } from "@/lib/voice/speakable"
import type { Reply } from "@/lib/types"
import {
  browserEngine,
  browserVoiceSupported,
  elevenLabsEngine,
  preloadElevenLabs,
  scriptedEngine,
  type EngineKind,
  type Listening,
  type Speaker,
  type VoiceEngine,
} from "@/lib/voice/engines"

export type VoiceStatus = "off" | "connecting" | "listening" | "thinking" | "speaking"

/** What the reply being spoken is about, for the stage's visuals. */
export interface SpokenContext {
  from?: string | null
  to?: string | null
  toCity?: string | null
  price?: string | null
  payment?: boolean
}

export interface VoiceState {
  status: VoiceStatus
  /** What the traveller is saying right now, before it is final. */
  partial: string
  /** The last thing they said, as sent. */
  heard: string
  /** The reply being spoken, word by word with timings. */
  words: SpokenWord[]
  replyId: number
  context: SpokenContext | null
  /** The full-screen stage is open. */
  stage: boolean
  engine: EngineKind | null
  error: string | null
}

const OFF: VoiceState = { status: "off", partial: "", heard: "", words: [], replyId: 0, context: null, stage: false, engine: null, error: null }

let state = OFF
const listeners = new Set<() => void>()
function set(next: VoiceState) {
  state = next
  listeners.forEach((l) => l())
}
const patch = (p: Partial<VoiceState>) => set({ ...state, ...p })
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useVoice(): VoiceState {
  return useSyncExternalStore(subscribe, () => state, () => OFF)
}

export function voiceActive() {
  return state.status !== "off"
}

// ------------------------------------------------------------ availability

export type Availability = { engine: "elevenlabs" | "browser"; note: string | null } | { engine: null; note: string }

let availability: Promise<Availability> | null = null

/** Decide which engine to use, ahead of the click (a click must not wait on a fetch to unlock audio). */
export function prepareVoice(): Promise<Availability> {
  availability ??= (async (): Promise<Availability> => {
    const status = await fetch("/api/voice/status")
      .then((r) => r.json() as Promise<{ elevenlabs?: boolean; disabled?: boolean }>)
      .catch(() => ({ elevenlabs: false, disabled: false }))
    if (status.disabled) return { engine: null, note: "Voice is switched off right now. You can keep typing." }
    if (status.elevenlabs) {
      void preloadElevenLabs()
      return { engine: "elevenlabs", note: null }
    }
    if (browserVoiceSupported()) {
      return { engine: "browser", note: "Using your browser's built-in voice. Add an ElevenLabs key for the Kiwi voice." }
    }
    return { engine: null, note: "Voice needs an ElevenLabs key on the server, or a browser with built-in speech recognition. You can keep typing." }
  })()
  return availability
}

let resolved: Availability | null = null
if (typeof window !== "undefined") {
  // Settled values are needed synchronously inside the click.
  queueMicrotask(() => void prepareVoice().then((a) => (resolved = a)))
}

// ---------------------------------------------------------------- session

let engine: VoiceEngine | null = null
let listening: Listening | null = null
let speaker: Speaker | null = null
let onUtterance: ((text: string) => void) | null = null
let session = 0
let reconnects = 0
/** The reply being (or last) spoken, for telling echo from the traveller. */
let replyWords = new Set<string>()
let replyEndedAt = 0

/** The chat registers how a heard sentence becomes a turn. */
export function setUtteranceHandler(fn: ((text: string) => void) | null) {
  onUtterance = fn
}

export function speechClock(): number {
  return speaker?.clock() ?? -1
}

export function speechLevel(): number {
  return speaker?.level() ?? 0
}

export function setStage(open: boolean) {
  patch({ stage: open })
}

const wordsOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9$' ]/g, " ").split(/\s+/).filter(Boolean)

/** Mostly the agent's own words: the speaker leaking into the microphone. */
function isEcho(text: string): boolean {
  const recent = state.status === "speaking" || performance.now() - replyEndedAt < 4000
  if (!recent || !replyWords.size) return false
  const words = wordsOf(text)
  if (!words.length) return true
  const known = words.filter((w) => replyWords.has(w)).length
  return known / words.length >= 0.6
}

const FILLER = /^(um+|uh+|hmm+|ah+|oh|mm+)[.!?]?$/i
const CUT_IN_WORDS = /^(stop|wait|hold on|hang on|no|actually|sorry)\b/i

function mic(on: boolean) {
  listening?.mute(!on)
}

function hearing(partial: string) {
  if (state.status === "speaking") {
    if (isEcho(partial)) return
    const novel = wordsOf(partial).filter((w) => !replyWords.has(w)).length
    if (novel >= 2 || CUT_IN_WORDS.test(partial.trim())) bargeIn(partial)
    return
  }
  if (state.status === "listening") patch({ partial })
}

function heard(raw: string) {
  const text = raw.trim()
  if (state.status === "speaking") {
    if (!text || isEcho(text)) return
    bargeIn(text)
  }
  if (state.status !== "listening") return
  if (!text || FILLER.test(text) || isEcho(text)) {
    patch({ partial: "" })
    return
  }
  mic(false)
  patch({ status: "thinking", partial: "", heard: text, context: null })
  onUtterance?.(text)
}

/** The traveller talked over the reply: stop the voice and listen. */
function bargeIn(partial: string) {
  speaker?.stop()
  replyEndedAt = performance.now()
  patch({ status: "listening", partial, words: [] })
}

async function connect(mySession: number) {
  if (!engine) return
  const conn = await engine.listen({
    onReady: () => {
      if (mySession !== session) return
      reconnects = 0
      if (state.status === "connecting") patch({ status: "listening", error: null })
      mic(state.status === "listening" || state.status === "speaking")
    },
    onPartial: (t) => mySession === session && hearing(t),
    onCommit: (t) => mySession === session && heard(t),
    onError: (m) => mySession === session && fail(m),
    onClose: () => {
      if (mySession !== session) return
      listening = null
      // Sessions have a time limit and networks drop: pick up again quietly.
      if (reconnects++ < 3) {
        setTimeout(() => {
          if (mySession === session) connect(mySession).catch((e) => fail(messageOf(e)))
        }, 400 * reconnects)
      } else fail("Lost the microphone connection. You can keep typing.")
    },
  })
  if (mySession !== session) {
    conn.close()
    return
  }
  listening = conn
}

function messageOf(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return /denied|NotAllowed|permission|not-allowed/i.test(msg) ? "Microphone access is blocked for this site. You can keep typing." : msg
}

function fail(message: string) {
  const stage = state.stage
  stopEverything()
  set({ ...OFF, stage, error: message })
}

/** Start voice mode. Call from a click: browsers only unlock audio and the mic there. */
export async function startVoice() {
  if (voiceActive()) {
    patch({ stage: true })
    return
  }
  const mySession = ++session
  reconnects = 0
  set({ ...OFF, status: "connecting", stage: true })

  const scripted = scriptedEngine()
  let choice: Availability | null = scripted ? { engine: "browser", note: null } : resolved
  if (!scripted && !choice) choice = await prepareVoice()
  if (mySession !== session) return
  if (!scripted && !choice?.engine) {
    set({ ...OFF, stage: true, error: choice?.note ?? "Voice isn't available." })
    return
  }
  try {
    engine = scripted ?? (choice!.engine === "elevenlabs" ? elevenLabsEngine() : browserEngine())
    patch({ engine: engine.kind })
    speaker = engine.speaker()
    await connect(mySession)
  } catch (e) {
    if (mySession === session) fail(messageOf(e))
  }
}

function stopEverything() {
  session++
  speaker?.stop()
  speaker = null
  listening?.close()
  listening = null
  engine?.close()
  engine = null
  replyWords = new Set()
}

export function endVoice() {
  stopEverything()
  set(OFF)
}

/** Close the stage after an error, or minimise it while voice runs. */
export function closeStage() {
  if (state.status === "off") set(OFF)
  else patch({ stage: false })
}

function backToListening() {
  if (!voiceActive()) return
  replyEndedAt = performance.now()
  patch({ status: "listening", partial: "" })
  mic(true)
}

/** A turn started while voice is on (typed, or a button): stop listening until it is answered. */
export function voiceTurnStarted() {
  if (state.status !== "listening") return
  mic(false)
  patch({ status: "thinking", partial: "", context: null })
}

/** Say something, then listen again. */
async function say(text: string, context: SpokenContext | null) {
  if (!voiceActive() || !speaker) return
  if (!text) return backToListening()
  const mine = speaker
  const reply = state.replyId + 1
  const current = () => state.replyId === reply && state.status === "speaking"
  replyWords = new Set(wordsOf(text))
  patch({ status: "speaking", words: [], context, replyId: reply })
  // The microphone stays open so the traveller can cut in.
  mic(true)
  try {
    await mine.play(text, (words) => {
      if (current()) patch({ words })
    })
  } catch {
    /* interrupted, or speech failed: the reply is on screen either way */
  }
  if (current()) backToListening()
}

/** The chat's reply. Says the speakable part, then listens again. */
export async function speakReply(markdown: string, reply?: Reply | null) {
  if (!voiceActive()) return
  const offer = reply?.offer
  const leg = offer?.legs?.[0]
  const context: SpokenContext | null = offer
    ? {
        from: leg?.from,
        to: leg?.to,
        toCity: leg?.toCity ?? leg?.toName,
        price: new Intl.NumberFormat("en-US", { style: "currency", currency: offer.price.currency || "USD", maximumFractionDigits: 0 }).format(offer.price.total),
      }
    : reply?.payment
      ? { payment: true }
      : null
  await say(spokenReply(markdown, reply), context)
  // Paying is a tap: hand the screen back to the PayPal button.
  if (context?.payment) patch({ stage: false })
}

/** Something worth saying that is not a chat reply (the booking landing). */
export function announce(text: string) {
  if (state.status === "listening") void say(text, null)
}

/** The turn ended without a reply to say (stopped). */
export function replySkipped() {
  if (state.status === "thinking") backToListening()
}

/** Tap the orb while it speaks: cut it short and listen. */
export function interrupt() {
  if (state.status !== "speaking") return
  speaker?.stop()
  backToListening()
}
