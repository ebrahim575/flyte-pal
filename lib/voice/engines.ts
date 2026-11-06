"use client"

/*
 * Where speech comes from and goes to. The controller (lib/voice/voice.ts)
 * does not care which engine runs:
 *
 *   elevenlabs  live transcription with a single-use token, Kiwi's voice
 *               streamed through /api/voice/speak. The real thing.
 *   browser     the browser's own speech recognition and synthesis, when no
 *               ElevenLabs key is configured (a fresh clone, mock mode).
 *   scripted    injected as window.__palVoiceEngine by scripts/screenshots.mjs
 *               so the voice screens can be driven without a microphone.
 */

import { SpeechPlayer, type SpokenWord } from "@/lib/voice/speech-player"

export type EngineKind = "elevenlabs" | "browser" | "scripted"

export interface ListenHandlers {
  onReady: () => void
  onPartial: (text: string) => void
  onCommit: (text: string) => void
  onError: (message: string) => void
  /** The session ended by itself (time limit, network). The controller may reconnect. */
  onClose: () => void
}

export interface Listening {
  mute(muted: boolean): void
  close(): void
}

export interface Speaker {
  /** Resolves when the last word has been heard, or on stop(). */
  play(text: string, onWords: (words: SpokenWord[]) => void): Promise<void>
  stop(): void
  /** Seconds into the reply coming out of the speaker now, or -1. */
  clock(): number
  /** 0..1 loudness, for the orb. */
  level(): number
}

export interface VoiceEngine {
  kind: EngineKind
  listen(handlers: ListenHandlers): Promise<Listening>
  speaker(): Speaker
  close(): void
}

/** Words the transcriber should lean towards. Max 50, 20 characters each. */
const KEYTERMS = ["Flyte", "PayPal", "Venmo", "Pay Later", "nonstop", "round trip", "one way", "layover", "carry-on", "window seat", "aisle seat", "business class", "economy"]

// ---------------------------------------------------------------- ElevenLabs

let sdk: Promise<typeof import("@elevenlabs/client")> | null = null
/** Start downloading the transcription SDK early (hover on the mic), so a click doesn't wait. */
export function preloadElevenLabs() {
  sdk ??= import("@elevenlabs/client")
  return sdk
}

async function fetchToken(): Promise<string> {
  const res = await fetch("/api/voice/token", { method: "POST" })
  const body = (await res.json().catch(() => null)) as { token?: string; detail?: string } | null
  if (!res.ok || !body?.token) throw new Error(body?.detail || "Couldn't start voice.")
  return body.token
}

/** Must be created inside a click: browsers only unlock audio there. */
export function elevenLabsEngine(): VoiceEngine {
  const audio = new AudioContext()
  void audio.resume()
  const scratch = new Uint8Array(new ArrayBuffer(128))

  return {
    kind: "elevenlabs",
    async listen(h) {
      const [token, { Scribe, CommitStrategy, RealtimeEvents }] = await Promise.all([fetchToken(), preloadElevenLabs()])
      const conn = Scribe.connect({
        token,
        modelId: "scribe_v2_realtime",
        commitStrategy: CommitStrategy.VAD,
        // How long a pause ends a sentence. Shorter feels snappier but cuts
        // people off mid-thought ("Chicago to... Seattle").
        vadSilenceThresholdSecs: 0.9,
        keyterms: KEYTERMS,
        // Echo cancellation is what lets the traveller talk over the reply.
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      let closed = false
      conn.on(RealtimeEvents.SESSION_STARTED, () => h.onReady())
      conn.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (m) => h.onPartial(m.text ?? ""))
      conn.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (m) => h.onCommit(m.text ?? ""))
      conn.on(RealtimeEvents.AUTH_ERROR, () => h.onError("Voice sign-in failed. Try again, or keep typing."))
      conn.on(RealtimeEvents.QUOTA_EXCEEDED, () => h.onError("Voice is unavailable right now. You can keep typing."))
      conn.on(RealtimeEvents.CLOSE, () => !closed && h.onClose())
      return {
        mute(muted) {
          try {
            if (muted) conn.mute()
            else conn.unmute()
          } catch {
            /* connection gone; onClose handles it */
          }
        },
        close() {
          closed = true
          try {
            conn.close()
          } catch {
            /* already closed */
          }
        },
      }
    },
    speaker() {
      let player: SpeechPlayer | null = null
      return {
        async play(text, onWords) {
          player = new SpeechPlayer(audio, onWords)
          await player.play(text)
        },
        stop: () => player?.stop(),
        clock: () => player?.clock() ?? -1,
        level: () => (player ? player.level(scratch) : 0),
      }
    },
    close() {
      void audio.close().catch(() => {})
    },
  }
}

// ------------------------------------------------------------------- Browser

interface BrowserRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type RecognitionCtor = new () => BrowserRecognition

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function browserVoiceSupported(): boolean {
  return typeof window !== "undefined" && !!recognitionCtor() && "speechSynthesis" in window
}

export function browserEngine(): VoiceEngine {
  const Ctor = recognitionCtor()!
  return {
    kind: "browser",
    async listen(h) {
      const rec = new Ctor()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = "en-US"
      let muted = false
      let closed = false
      rec.onstart = () => h.onReady()
      rec.onresult = (e) => {
        if (muted) return
        let interim = ""
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) h.onCommit(r[0].transcript)
          else interim += r[0].transcript
        }
        if (interim) h.onPartial(interim)
      }
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") h.onError("Microphone access is blocked for this site. You can keep typing.")
      }
      // Browser recognition stops on its own after a pause; keep it going.
      rec.onend = () => {
        if (!closed) {
          try {
            rec.start()
          } catch {
            h.onClose()
          }
        }
      }
      rec.start()
      return {
        mute: (m) => {
          muted = m
        },
        close: () => {
          closed = true
          rec.abort()
        },
      }
    },
    speaker() {
      let startedAt = -1
      let utterance: SpeechSynthesisUtterance | null = null
      let resolve: (() => void) | null = null
      return {
        play(text, onWords) {
          return new Promise<void>((done) => {
            resolve = done
            // No timings from the browser up front: estimate them, then
            // correct each word as the browser reaches it.
            const words: SpokenWord[] = []
            let t = 0
            for (const w of text.split(/\s+/).filter(Boolean)) {
              const dur = 0.12 + w.length * 0.055
              words.push({ text: w, start: t, end: t + dur })
              t += dur
            }
            onWords(words)
            utterance = new SpeechSynthesisUtterance(text)
            utterance.rate = 1.05
            utterance.onstart = () => (startedAt = performance.now())
            utterance.onend = () => done()
            utterance.onerror = () => done()
            window.speechSynthesis.cancel()
            window.speechSynthesis.speak(utterance)
          })
        },
        stop() {
          window.speechSynthesis.cancel()
          resolve?.()
        },
        clock: () => (startedAt < 0 ? -1 : (performance.now() - startedAt) / 1000),
        level: () => (startedAt < 0 ? 0 : 0.35 + 0.25 * Math.abs(Math.sin(performance.now() / 140))),
      }
    },
    close() {
      window.speechSynthesis?.cancel()
    },
  }
}

// ------------------------------------------------------------------ Scripted

export function scriptedEngine(): VoiceEngine | null {
  const factory = (window as unknown as { __palVoiceEngine?: () => VoiceEngine }).__palVoiceEngine
  return typeof factory === "function" ? factory() : null
}
