import { NextResponse } from "next/server"
import { crossSite, isMock, refuseCrossSite, validConversationId } from "@/lib/server/flyte-api"
import { checkLimit, tooMany } from "@/lib/server/rate-limit"
import { flyteJson, mockState, saveMockState } from "@/lib/server/paypal"

const ORDER_ID = /^[A-Za-z0-9-]{6,64}$/

/** The buyer approved in PayPal: capture on the server. */
export async function POST(request: Request) {
  if (crossSite(request)) return refuseCrossSite()
  const limited = checkLimit(request, "paypal")
  if (limited) return tooMany(limited)
  const body = (await request.json().catch(() => ({}))) as { conversation_id?: unknown; order_id?: unknown }
  if (!validConversationId(body.conversation_id) || typeof body.order_id !== "string" || !ORDER_ID.test(body.order_id)) {
    return NextResponse.json({ detail: "A conversation id and an order id are required" }, { status: 400 })
  }

  if (isMock()) {
    const state = await mockState(body.conversation_id)
    if (state.orderId !== body.order_id) {
      return NextResponse.json({ detail: "That order doesn't belong to this conversation" }, { status: 409 })
    }
    await saveMockState({ ...state, step: "paid", paidAt: Date.now() })
    return NextResponse.json({ captured: true })
  }

  const result = await flyteJson(request, "paypalCapture", {
    method: "POST",
    body: JSON.stringify({ conversation_id: body.conversation_id, order_id: body.order_id }),
  })
  if (!result.ok) return result.response
  return NextResponse.json({ captured: true })
}
