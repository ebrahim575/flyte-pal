import "server-only"
import type { ChatEvent, FlightOffer, Leg, PaymentOutcome, ProgressStep, Segment, Trip, TripLeg } from "@/lib/types"

/*
 * The one place the Flyte AI API's responses are read. Each function takes
 * whatever came back and returns Flyte Pal's own shape (lib/types.ts), field
 * by field, so nothing else reaches the browser. Tolerant on purpose: a
 * missing field stays missing, never invented.
 */

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {})
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

// ------------------------------------------------------------------ chat

const STEPS: Record<string, ProgressStep> = {
  reading: "read",
  extracting: "understand",
  searching: "search",
  found: "compare",
  composing: "choose",
  verifying: "verify",
  verified: "verify",
  routing: "book",
  routed: "book",
  booking: "book",
}

function segment(raw: unknown): Segment {
  const s = obj(raw)
  return {
    from: str(s.from) ?? undefined,
    to: str(s.to) ?? undefined,
    fromName: str(s.fromName),
    toName: str(s.toName),
    departAt: str(s.departAt),
    arriveAt: str(s.arriveAt),
    carrier: str(s.carrier),
    carrierName: str(s.carrierName),
    flightNumber: str(s.flightNumber),
    durationMinutes: num(s.durationMinutes),
  }
}

function leg(raw: unknown): Leg {
  const l = obj(raw)
  return {
    from: str(l.from) ?? undefined,
    to: str(l.to) ?? undefined,
    fromName: str(l.fromName),
    toName: str(l.toName),
    toCity: str(l.toCity),
    departAt: str(l.departAt),
    arriveAt: str(l.arriveAt),
    stops: num(l.stops) ?? 0,
    via: list(l.via).map(str).filter((v): v is string => !!v),
    durationMinutes: num(l.durationMinutes),
    layovers: list(l.layovers).map((x) => ({ at: str(obj(x).at) ?? undefined, minutes: num(obj(x).minutes) })),
    segments: list(l.segments).map(segment),
  }
}

export function adaptOffer(raw: unknown): FlightOffer | null {
  const o = obj(raw)
  const legs = list(o.legs).map(leg).filter((l) => l.from || l.to)
  const price = obj(o.price)
  const total = num(price.total)
  if (!legs.length || total === null) return null
  const bags = obj(o.baggage)
  return {
    legs,
    tripType: o.tripType === "round-trip" || legs.length > 1 ? "round-trip" : "one-way",
    carrier: str(o.validatingCarrier) ?? str(o.carrier),
    carrierName: str(o.validatingCarrierName) ?? str(o.carrierName),
    price: { total, currency: str(price.currency) ?? "USD" },
    refundable: o.refundable === true,
    baggage: { checked: str(bags.checked), carryOn: str(bags.carryOn) },
    resultsCount: num(o.resultsCount) ?? undefined,
  }
}

/** One streamed line from the agent, as Flyte Pal's event, or null to drop it. */
export function adaptChatLine(raw: unknown): ChatEvent | null {
  const line = obj(raw)
  if (line.type === "stage") {
    return {
      kind: "progress",
      step: STEPS[str(line.stage) ?? ""] ?? "working",
      from: str(line.origin),
      to: str(line.destination),
      departDate: str(line.departure_date),
      returnDate: str(line.return_date),
      count: num(line.count),
    }
  }
  if (line.type === "result") {
    const meta = obj(line.metadata)
    const details = obj(meta.paymentDetails)
    const charge = num(details.cardAmount) ?? num(details.amount)
    const offer = meta.flightOffer ? adaptOffer(meta.flightOffer) : null
    return {
      kind: "reply",
      text: str(line.response) ?? "",
      offer,
      canBook: offer ? meta.bookingOpen !== false : undefined,
      payment: meta.content_type === "payment_request" && charge !== null ? { charge, currency: "USD" } : null,
      demo: meta.testMode === true,
    }
  }
  if (line.type === "error") return { kind: "error", message: str(line.detail) ?? "Something went wrong. Please try again." }
  return null
}

// --------------------------------------------------------------- payment

export function adaptOrder(raw: unknown): { orderId: string } | null {
  const o = obj(raw)
  const id = str(o.order_id) ?? str(o.orderId) ?? str(o.id)
  return id ? { orderId: id } : null
}

const IN_PROGRESS = new Set(["pending", "ticket_pending", "booking", ""])
const FINISHED: Record<string, { message: string; retry: boolean }> = {
  refunded: { message: "The booking didn't go through, so your payment was refunded.", retry: true },
  needs_review: { message: "Your payment is on hold while the booking is checked by hand. Please don't pay again.", retry: false },
  payment_not_verified: { message: "The payment couldn't be verified, so nothing was booked. You can try again.", retry: true },
  demo_test_booking: { message: "Test booking finished. No ticket is issued in demo mode, and any test payment was returned.", retry: false },
  simulated_not_booked: { message: "The simulated booking didn't go through. Nothing was charged.", retry: true },
}

/** What a payment ended as. Only an explicit booking is "booked"; anything unknown and final is a failure. */
export function adaptPaymentStatus(raw: unknown): PaymentOutcome {
  const data = obj(raw)
  const meta = obj(data.metadata)
  const booking = obj(data.booking ?? meta.booking)
  const status = (str(data.status) ?? "").toLowerCase()
  const message = str(data.response) ?? str(data.detail)
  const pick = (...keys: string[]) => keys.map((k) => str(data[k]) ?? str(meta[k]) ?? str(booking[k])).find(Boolean) ?? null

  if (status === "booked") {
    return {
      state: "booked",
      reference: pick("booking_reference", "bookingReference", "booking_ref", "reference", "order_id"),
      airlineRef: pick("airline_pnr", "airlinePnr", "pnr"),
      demo: [data, meta, booking].some((o) => o.is_mock === true || o.simulated === true),
      message,
    }
  }
  if (IN_PROGRESS.has(status)) return { state: "pending", message }
  const known = FINISHED[status]
  return {
    state: "failed",
    message: message ?? known?.message ?? "The booking didn't go through. Nothing was booked.",
    retry: known?.retry ?? false,
  }
}

// ----------------------------------------------------------------- trips

function tripLeg(slice: unknown): TripLeg | null {
  const segments = list(obj(slice).segments).map(obj)
  if (!segments.length) return null
  const first = segments[0]
  const last = segments[segments.length - 1]
  return {
    from: str(obj(first.origin).iata_code),
    to: str(obj(last.destination).iata_code),
    departAt: str(first.departing_at),
    arriveAt: str(last.arriving_at),
    carrier: str(obj(first.marketing_carrier).name),
    stops: segments.length - 1,
  }
}

export function adaptTrips(raw: unknown): Trip[] {
  return list(obj(raw).bookings).map((value, i) => {
    const b = obj(value)
    const data = obj(obj(b.raw_booking_data).data)
    return {
      id: str(b.id) ?? str(b.booking_id) ?? `trip-${i}`,
      reference: str(b.booking_reference) ?? str(b.booking_id),
      airlineRef: str(b.airline_pnr),
      bookedAt: str(b.created_at),
      confirmed: str(b.status) === "confirmed",
      demo: b.is_mock === true,
      legs: list(data.slices).map(tripLeg).filter((l): l is TripLeg => l !== null),
      travellers: list(data.passengers)
        .map((p) => [str(obj(p).given_name), str(obj(p).family_name)].filter(Boolean).join(" "))
        .filter(Boolean),
      charged: num(data.total_amount),
      currency: str(data.total_currency) ?? "USD",
      conversationId: str(b.conversation_id),
    }
  })
}

// --------------------------------------------------------------- session

/** The session token from a sign-in answer. */
export function adaptSession(raw: unknown): { token: string | null } {
  return { token: str(obj(raw).token) }
}
