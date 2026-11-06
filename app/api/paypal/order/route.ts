import { NextResponse } from "next/server"
import { crossSite, isMock, refuseCrossSite, validConversationId } from "@/lib/server/flyte-api"
import { checkLimit, tooMany } from "@/lib/server/rate-limit"
import { flyteJson, mockState, saveMockState } from "@/lib/server/paypal"
import { adaptOrder } from "@/lib/server/adapt"

/** Open a PayPal order for this conversation's booking. The amount is never sent from here. */
export async function POST(request: Request) {
  if (crossSite(request)) return refuseCrossSite()
  const limited = checkLimit(request, "paypal")
  if (limited) return tooMany(limited)
  const body = (await request.json().catch(() => ({}))) as { conversation_id?: unknown }
  if (!validConversationId(body.conversation_id)) {
    return NextResponse.json({ detail: "A conversation id is required" }, { status: 400 })
  }
  const conversationId = body.conversation_id

  if (isMock()) {
    const state = await mockState(conversationId)
    if (state.step !== "awaiting_payment") {
      return NextResponse.json({ detail: "There is no payment waiting in this conversation" }, { status: 409 })
    }
    const orderId = `MOCK-${crypto.randomUUID().slice(0, 13).toUpperCase()}`
    await saveMockState({ ...state, orderId })
    return NextResponse.json({ orderId })
  }

  const result = await flyteJson(request, "paypalOrder", { method: "POST", body: JSON.stringify({ conversation_id: conversationId }) })
  if (!result.ok) return result.response
  const order = adaptOrder(result.data)
  return order ? NextResponse.json(order) : NextResponse.json({ detail: "PayPal didn't open an order. Please try again." }, { status: 502 })
}
