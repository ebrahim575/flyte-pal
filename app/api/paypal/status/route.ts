import { NextResponse } from "next/server"
import { isMock, validConversationId } from "@/lib/server/flyte-api"
import { addMockTrip, flyteJson, mockState } from "@/lib/server/paypal"
import { adaptPaymentStatus } from "@/lib/server/adapt"
import { SIMULATED_LOCATOR, simulatedReference } from "@/lib/mock/engine"
import type { PaymentOutcome } from "@/lib/types"

/** What the payment ended as, for the page to poll. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const conversationId = url.searchParams.get("conversation_id")
  const orderId = url.searchParams.get("order_id") ?? ""
  if (!validConversationId(conversationId) || !/^[A-Za-z0-9-]{6,64}$/.test(orderId)) {
    return NextResponse.json({ detail: "A conversation id and an order id are required" }, { status: 400 })
  }

  if (isMock()) {
    const state = await mockState(conversationId)
    const pending: PaymentOutcome = { state: "pending" }
    if (state.orderId !== orderId || state.step !== "paid" || !state.paidAt) return NextResponse.json(pending)
    // A short wait, so the booking step is visible.
    if (Date.now() - state.paidAt < 2500) return NextResponse.json(pending)
    await addMockTrip({
      orderId,
      cid: conversationId,
      origin: state.origin ?? "ORD",
      destination: state.destination ?? "DXB",
      depart: state.depart!,
      ret: state.ret ?? null,
      budget: state.budget ?? null,
      at: new Date(state.paidAt).toISOString(),
    })
    const booked: PaymentOutcome = {
      state: "booked",
      reference: simulatedReference(orderId),
      airlineRef: SIMULATED_LOCATOR,
      demo: true,
      message: "Your demo booking is confirmed.",
    }
    return NextResponse.json(booked)
  }

  const result = await flyteJson(request, "paypalStatus", { method: "GET", query: { conversation_id: conversationId, order_id: orderId } })
  if (!result.ok) return result.response
  return NextResponse.json(adaptPaymentStatus(result.data))
}
