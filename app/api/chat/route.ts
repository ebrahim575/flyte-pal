import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { NotConfigured, callFlyte, crossSite, isMock, refuseCrossSite, sessionToken, validConversationId } from "@/lib/server/flyte-api"
import { adaptChatLine } from "@/lib/server/adapt"
import { MOCK_COOKIE, decodeState, encodeState, mockTurn } from "@/lib/mock/engine"
import { checkLimit } from "@/lib/server/rate-limit"
import type { ChatEvent } from "@/lib/types"

// A live flight search can take a couple of minutes.
export const maxDuration = 120

const STREAM = { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform" }
const line = (event: ChatEvent) => JSON.stringify(event) + "\n"

function errorEvent(message: string, status = 200) {
  return new Response(line({ kind: "error", message }), { status, headers: STREAM })
}

export async function POST(request: Request) {
  if (crossSite(request)) return refuseCrossSite()
  let body: { message?: unknown; conversation_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: "Bad request" }, { status: 400 })
  }
  const message = typeof body.message === "string" ? body.message.slice(0, 2000).trim() : ""
  const conversationId = body.conversation_id
  if (!message || !validConversationId(conversationId)) {
    return NextResponse.json({ detail: "A message and a conversation id are required" }, { status: 400 })
  }

  const limited = checkLimit(request, "chat")
  if (limited) return errorEvent(limited.message, 429)
  if (!(await sessionToken())) return errorEvent("Please sign in to keep going.", 401)
  if (isMock()) return mockStream(message, conversationId)

  let upstream: Response
  try {
    upstream = await callFlyte(request, "chat", {
      method: "POST",
      body: JSON.stringify({ message, conversation_id: conversationId }),
      // The visitor leaving stops the search upstream too.
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]),
    })
  } catch (error) {
    if (error instanceof NotConfigured) return errorEvent("Flyte Pal isn't fully configured on this server.", 503)
    if (error instanceof Error && error.name === "TimeoutError") return errorEvent("That search took too long. Please try again.")
    return errorEvent("Couldn't reach the Flyte AI agent. Please try again.")
  }
  if (upstream.status === 401 || upstream.status === 403) return errorEvent("Your session expired. Please sign in again.", 401)
  if (upstream.status === 429) return errorEvent("Lots of searches right now. Give it a minute and try again.")
  if (!upstream.ok || !upstream.body) return errorEvent("The Flyte AI agent couldn't answer that. Please try again.")

  // Every line is translated into Flyte Pal's own event; anything else is dropped.
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ""
  const translate = (raw: string) => {
    if (!raw.trim()) return null
    try {
      const event = adaptChatLine(JSON.parse(raw))
      return event ? encoder.encode(line(event)) : null
    } catch {
      return null
    }
  }
  const stream = upstream.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true })
        const parts = buffer.split("\n")
        buffer = parts.pop() ?? ""
        for (const part of parts) {
          const out = translate(part)
          if (out) controller.enqueue(out)
        }
      },
      flush(controller) {
        const out = translate(buffer)
        if (out) controller.enqueue(out)
      },
    }),
  )
  return new Response(stream, { status: 200, headers: STREAM })
}

async function mockStream(message: string, conversationId: string) {
  const jar = await cookies()
  const state = decodeState(jar.get(MOCK_COOKIE)?.value, conversationId)
  const turn = mockTurn(message, state)
  jar.set(MOCK_COOKIE, encodeState(turn.next), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 6 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const { delay, event } of turn.events) {
        await new Promise((r) => setTimeout(r, delay))
        controller.enqueue(encoder.encode(line(event)))
      }
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: STREAM })
}
