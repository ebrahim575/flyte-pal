"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ChatEvent, ChatMessage, Progress, Via } from "@/lib/types"

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`
}

type ReplyListener = (message: ChatMessage) => void

/**
 * One conversation with the Flyte AI agent. Typed and spoken turns go through
 * the same `send`, so voice plugs in without a second code path.
 */
export function useConversation() {
  const [conversationId, setConversationId] = useState(() => newId("pal"))
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [liveStages, setLiveStages] = useState<Progress[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const listeners = useRef(new Set<ReplyListener>())

  const onReply = useCallback((fn: ReplyListener) => {
    listeners.current.add(fn)
    return () => {
      listeners.current.delete(fn)
    }
  }, [])

  const pushAssistant = useCallback((message: ChatMessage) => {
    setMessages((m) => [...m, message])
    for (const fn of listeners.current) fn(message)
  }, [])

  const send = useCallback(
    async (text: string, opts: { via?: Via } = {}) => {
      const content = text.trim()
      if (!content || busy) return
      setBusy(true)
      setLiveStages([])
      setMessages((m) => [...m, { id: newId("m"), role: "user", content, via: opts.via ?? "text" }])

      const controller = new AbortController()
      abortRef.current = controller
      const stages: Progress[] = []
      let settled = false

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, conversation_id: conversationId }),
          signal: controller.signal,
        })
        if (!res.body) throw new Error("No response")
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        const handle = (raw: string) => {
          if (!raw.trim()) return
          let event: ChatEvent
          try {
            event = JSON.parse(raw)
          } catch {
            return
          }
          if (event.kind === "progress") {
            const { kind: _k, ...rest } = event
            void _k
            stages.push({ ...rest, at: Date.now() })
            setLiveStages([...stages])
          } else if (event.kind === "reply") {
            settled = true
            const { kind: _k, text, ...reply } = event
            void _k
            pushAssistant({ id: newId("m"), role: "assistant", content: text, reply, progress: [...stages] })
          } else if (event.kind === "error") {
            settled = true
            pushAssistant({ id: newId("m"), role: "assistant", content: event.message || "Something went wrong. Please try again.", error: true })
          }
        }

        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split("\n")
          buffer = parts.pop() ?? ""
          parts.forEach(handle)
        }
        if (buffer) handle(buffer)
        if (!settled) {
          pushAssistant({ id: newId("m"), role: "assistant", content: "The connection dropped before an answer came back. Please try again.", error: true })
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          pushAssistant({ id: newId("m"), role: "assistant", content: "Couldn't reach the Flyte AI agent. Please try again.", error: true })
        }
      } finally {
        abortRef.current = null
        setLiveStages([])
        setBusy(false)
      }
    },
    [busy, conversationId, pushAssistant],
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setLiveStages([])
    setConversationId(newId("pal"))
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  return { conversationId, messages, busy, liveStages, send, stop, reset, onReply }
}

export type Conversation = ReturnType<typeof useConversation>
