/*
 * Flyte Pal's own shapes: what the browser sees. The server translates
 * everything it receives into these (lib/server/adapt.ts), and the mock
 * backend speaks them directly. Optional fields render only when present;
 * nothing is invented.
 */

export interface Segment {
  from?: string
  to?: string
  fromName?: string | null
  toName?: string | null
  departAt?: string | null
  arriveAt?: string | null
  carrier?: string | null
  carrierName?: string | null
  flightNumber?: string | null
  durationMinutes?: number | null
}

export interface Layover {
  at?: string
  minutes?: number | null
}

export interface Leg {
  from?: string
  to?: string
  fromName?: string | null
  toName?: string | null
  toCity?: string | null
  departAt?: string | null
  arriveAt?: string | null
  stops?: number
  via?: string[]
  durationMinutes?: number | null
  layovers?: Layover[]
  segments?: Segment[]
}

export interface FlightOffer {
  legs: Leg[]
  tripType?: "round-trip" | "one-way"
  carrier?: string | null
  carrierName?: string | null
  price: { total: number; currency: string }
  refundable?: boolean
  baggage?: { checked?: string | null; carryOn?: string | null }
  resultsCount?: number
}

/** The payment step: what PayPal will charge. */
export interface PaymentAsk {
  charge: number
  currency: string
}

/** The agent's reply, beyond its words. */
export interface Reply {
  offer?: FlightOffer | null
  /** The offer can be booked from here. */
  canBook?: boolean
  payment?: PaymentAsk | null
  /** A demo environment: simulated booking, sandbox payment. */
  demo?: boolean
}

export type ProgressStep = "read" | "understand" | "search" | "compare" | "choose" | "verify" | "book" | "working"

export interface Progress {
  step: ProgressStep
  at: number
  from?: string | null
  to?: string | null
  departDate?: string | null
  returnDate?: string | null
  count?: number | null
}

/** One line of a streamed turn: progress while the agent works, then a reply or an error. */
export type ChatEvent =
  | ({ kind: "progress" } & Omit<Progress, "at">)
  | ({ kind: "reply"; text: string } & Reply)
  | { kind: "error"; message: string }

export type Via = "text" | "voice"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  via?: Via
  reply?: Reply | null
  /** What the agent did on the way to this reply. */
  progress?: Progress[]
  error?: boolean
}

/** What a payment ended as. */
export interface PaymentOutcome {
  state: "pending" | "booked" | "failed"
  reference?: string | null
  airlineRef?: string | null
  demo?: boolean
  message?: string | null
  /** Whether paying again from this card makes sense. */
  retry?: boolean
}

export interface TripLeg {
  from: string | null
  to: string | null
  departAt: string | null
  arriveAt: string | null
  carrier: string | null
  stops: number
}

export interface Trip {
  id: string
  reference: string | null
  airlineRef: string | null
  bookedAt: string | null
  confirmed: boolean
  demo: boolean
  legs: TripLeg[]
  travellers: string[]
  /** What was actually charged. */
  charged: number | null
  currency: string
  conversationId: string | null
}
