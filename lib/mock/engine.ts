import "server-only"
import type { ChatEvent, FlightOffer, Leg, Reply, Trip } from "@/lib/types"

/*
 * The built-in mock backend. It answers in Flyte Pal's own shapes, so the UI
 * cannot tell the difference except by the "Mock mode" label. Nothing here is
 * a real fare.
 *
 * State lives in a cookie (see app/api/chat/route.ts), not in memory, so it
 * survives serverless cold starts.
 */

export type MockStep = "idle" | "offered" | "confirming" | "awaiting_payment" | "paid"

export interface MockState {
  cid: string
  step: MockStep
  origin?: string
  destination?: string
  depart?: string
  ret?: string | null
  budget?: number | null
  orderId?: string
  paidAt?: number
}

const PLACES: Record<string, { code: string; city: string; airport: string }> = {
  dubai: { code: "DXB", city: "Dubai", airport: "Dubai International" },
  london: { code: "LHR", city: "London", airport: "Heathrow" },
  tokyo: { code: "HND", city: "Tokyo", airport: "Haneda" },
  paris: { code: "CDG", city: "Paris", airport: "Charles de Gaulle" },
  "new york": { code: "JFK", city: "New York", airport: "John F. Kennedy" },
  nyc: { code: "JFK", city: "New York", airport: "John F. Kennedy" },
  lisbon: { code: "LIS", city: "Lisbon", airport: "Humberto Delgado" },
  istanbul: { code: "IST", city: "Istanbul", airport: "Istanbul Airport" },
  doha: { code: "DOH", city: "Doha", airport: "Hamad International" },
  "los angeles": { code: "LAX", city: "Los Angeles", airport: "Los Angeles International" },
  la: { code: "LAX", city: "Los Angeles", airport: "Los Angeles International" },
  miami: { code: "MIA", city: "Miami", airport: "Miami International" },
  chicago: { code: "ORD", city: "Chicago", airport: "O'Hare" },
  "san francisco": { code: "SFO", city: "San Francisco", airport: "San Francisco International" },
  toronto: { code: "YYZ", city: "Toronto", airport: "Pearson" },
  "mexico city": { code: "MEX", city: "Mexico City", airport: "Benito Juarez" },
  cancun: { code: "CUN", city: "Cancun", airport: "Cancun International" },
  rome: { code: "FCO", city: "Rome", airport: "Fiumicino" },
  barcelona: { code: "BCN", city: "Barcelona", airport: "El Prat" },
  seoul: { code: "ICN", city: "Seoul", airport: "Incheon" },
  bali: { code: "DPS", city: "Bali", airport: "Ngurah Rai" },
  singapore: { code: "SIN", city: "Singapore", airport: "Changi" },
  cairo: { code: "CAI", city: "Cairo", airport: "Cairo International" },
  karachi: { code: "KHI", city: "Karachi", airport: "Jinnah International" },
  lahore: { code: "LHE", city: "Lahore", airport: "Allama Iqbal" },
  jeddah: { code: "JED", city: "Jeddah", airport: "King Abdulaziz" },
}

const byCode = Object.fromEntries(Object.values(PLACES).map((p) => [p.code, p]))

const CARRIERS = [
  { code: "FA", name: "Falcon Air" },
  { code: "MR", name: "Meridian Airways" },
  { code: "NV", name: "Northvale" },
]

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]

function findPlaces(text: string): { origin?: string; destination?: string } {
  const lower = ` ${text.toLowerCase()} `
  const hits: { code: string; index: number; from: boolean }[] = []
  for (const [name, place] of Object.entries(PLACES)) {
    const re = new RegExp(`[^a-z]${name}[^a-z]`)
    const m = re.exec(lower)
    if (m) {
      hits.push({ code: place.code, index: m.index, from: /from\s$/.test(lower.slice(0, m.index + 1)) })
    }
  }
  const fromHit = hits.find((h) => h.from)
  const toHit = hits.filter((h) => !h.from).sort((a, b) => a.index - b.index)[0]
  return { origin: fromHit?.code, destination: toHit?.code }
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function findDates(text: string): { depart: string; ret: string | null } {
  const lower = text.toLowerCase()
  const now = new Date()
  let depart = new Date(now.getTime() + 21 * 86400000)
  const monthIndex = MONTHS.findIndex((m) => lower.includes(m) || lower.includes(m.slice(0, 3) + " "))
  if (monthIndex >= 0) {
    const year = monthIndex < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear()
    const day = /last week/.test(lower) ? 24 : /end of/.test(lower) ? 26 : /mid/.test(lower) ? 15 : 8
    depart = new Date(Date.UTC(year, monthIndex, day))
  }
  const oneWay = /one[ -]?way/.test(lower)
  const nights = Number(/(\d+)\s*(night|day)/.exec(lower)?.[1] ?? 7)
  const ret = oneWay ? null : iso(new Date(depart.getTime() + Math.max(1, Math.min(nights, 30)) * 86400000))
  return { depart: iso(depart), ret }
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h)
}

function leg(from: string, to: string, date: string, seed: number, carrier: { code: string; name: string }): Leg {
  const depHour = 7 + (seed % 12)
  const depMin = [5, 20, 35, 50][seed % 4]
  const flightMinutes = 300 + (seed % 540)
  const stops = seed % 3 === 0 ? 1 : 0
  const layover = stops ? 85 + (seed % 70) : 0
  const departAt = new Date(`${date}T${String(depHour).padStart(2, "0")}:${String(depMin).padStart(2, "0")}:00Z`)
  const arriveAt = new Date(departAt.getTime() + (flightMinutes + layover) * 60000)
  const hub = "IST"
  const fromP = byCode[from]
  const toP = byCode[to]
  const segments = stops
    ? [
        { from, to: hub, fromName: fromP?.airport, toName: "Istanbul Airport", departAt: departAt.toISOString(), arriveAt: new Date(departAt.getTime() + (flightMinutes / 2) * 60000).toISOString(), carrier: carrier.code, carrierName: carrier.name, flightNumber: String(100 + (seed % 800)), durationMinutes: Math.round(flightMinutes / 2) },
        { from: hub, to, fromName: "Istanbul Airport", toName: toP?.airport, departAt: new Date(departAt.getTime() + (flightMinutes / 2 + layover) * 60000).toISOString(), arriveAt: arriveAt.toISOString(), carrier: carrier.code, carrierName: carrier.name, flightNumber: String(900 + (seed % 90)), durationMinutes: Math.round(flightMinutes / 2) },
      ]
    : [{ from, to, fromName: fromP?.airport, toName: toP?.airport, departAt: departAt.toISOString(), arriveAt: arriveAt.toISOString(), carrier: carrier.code, carrierName: carrier.name, flightNumber: String(100 + (seed % 800)), durationMinutes: flightMinutes }]
  return {
    from,
    to,
    fromName: fromP?.airport ?? from,
    toName: toP?.airport ?? to,
    toCity: toP?.city ?? to,
    departAt: departAt.toISOString(),
    arriveAt: arriveAt.toISOString(),
    stops,
    via: stops ? [hub] : [],
    durationMinutes: flightMinutes + layover,
    layovers: stops ? [{ at: hub, minutes: layover }] : [],
    segments,
  }
}

export function mockOffer(state: MockState): FlightOffer {
  const origin = state.origin ?? "ORD"
  const destination = state.destination ?? "DXB"
  const seed = hash(`${origin}-${destination}-${state.depart}`)
  const carrier = CARRIERS[seed % CARRIERS.length]
  const legs = [leg(origin, destination, state.depart!, seed, carrier)]
  if (state.ret) legs.push(leg(destination, origin, state.ret, seed >> 3, carrier))
  let total = Math.round((380 + (seed % 620) + (state.ret ? 210 : 0)) * 100) / 100 + 0.4
  // Respect a stated budget, so "under $900" comes back under $900.
  if (state.budget && total > state.budget) total = Math.round(state.budget * (0.78 + (seed % 15) / 100)) + 0.4
  return {
    legs,
    tripType: state.ret ? "round-trip" : "one-way",
    carrier: carrier.code,
    carrierName: carrier.name,
    price: { total, currency: "USD" },
    refundable: seed % 2 === 0,
    baggage: { checked: "1PC", carryOn: "7K" },
    resultsCount: 120 + (seed % 260),
  }
}

const AFFIRM = /\b(yes|yeah|yep|sure|book|confirm|go ahead|do it|that one|looks good|sounds good|ok|okay|perfect)\b/i
const RESET = /\b(start over|new search|reset|different trip|somewhere else)\b/i

export interface MockTurn {
  events: { delay: number; event: ChatEvent }[]
  next: MockState
}

function money(n: number) {
  return `$${n.toFixed(2)}`
}

function dateLabel(isoDate?: string | null) {
  if (!isoDate) return ""
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
}

export function mockTurn(message: string, state: MockState): MockTurn {
  const text = message.trim()
  const step = (s: "read" | "understand" | "verify" | "choose", delay: number) => ({ delay, event: { kind: "progress", step: s } as ChatEvent })
  const reading = step("read", 250)
  const extracting = step("understand", 550)
  const reply = (text: string, extra: Reply = {}, delay = 450) => ({
    delay,
    event: { kind: "reply", text, demo: true, ...extra } as ChatEvent,
  })

  if (RESET.test(text)) {
    return {
      events: [reading, reply("Fresh start. Where would you like to go?")],
      next: { cid: state.cid, step: "idle" },
    }
  }

  if (state.step === "offered" && AFFIRM.test(text)) {
    const offer = mockOffer(state)
    const out = offer.legs[0]
    const summary = [
      "Here's your booking summary:",
      "",
      `**Traveller:** Demo Traveller (adult)`,
      `**Flight:** ${byCode[out.from!]?.city ?? out.from} to ${out.toCity} with ${offer.carrierName}`,
      `**Departs:** ${dateLabel(state.depart)}${state.ret ? `, returns ${dateLabel(state.ret)}` : ", one way"}`,
      `**Total:** ${money(offer.price.total)}`,
      "",
      "Reply **yes** to confirm and accept the fare rules and terms.",
    ].join("\n")
    return {
      events: [reading, step("verify", 700), reply(summary)],
      next: { ...state, step: "confirming" },
    }
  }

  if (state.step === "confirming" && AFFIRM.test(text)) {
    return {
      events: [
        reading,
        step("verify", 600),
        // Like the hackathon backend: any fare is charged $0.01 in PayPal sandbox.
        reply("Ready to book this flight?", { payment: { charge: MOCK_CHARGE_USD, currency: "USD" } }),
      ],
      next: { ...state, step: "awaiting_payment" },
    }
  }

  if (state.step === "awaiting_payment" || state.step === "paid") {
    return {
      events: [reading, reply(state.step === "paid" ? "You're all set. Your demo booking is confirmed above." : "Your payment is waiting on screen. Finish it with PayPal, Venmo or Pay Later and I'll book it straight away.")],
      next: state,
    }
  }

  const found = findPlaces(text)
  const destination = found.destination ?? (state.step !== "idle" ? state.destination : undefined)
  if (!destination) {
    return {
      events: [reading, extracting, reply("Happy to help. Where would you like to fly, and roughly when? For example: \"Dubai the last week of December\".")],
      next: { ...state, step: "idle" },
    }
  }
  const origin = found.origin ?? state.origin ?? (destination === "ORD" ? "JFK" : "ORD")
  const { depart, ret } = findDates(text)
  const budgetMatch = /(?:under|below|less than|max|up to)\s*\$?\s*(\d[\d,]*)/i.exec(text)
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, "")) : null
  const next: MockState = { cid: state.cid, step: "offered", origin, destination, depart, ret, budget }
  const offer = mockOffer(next)
  const out = offer.legs[0]
  const stopsText = out.stops ? `${out.stops} stop via ${out.via?.join(", ")}` : "nonstop"
  const response = [
    `I searched ${offer.resultsCount} fares from ${byCode[origin]?.city ?? origin} to ${out.toCity}. The best one is ${offer.carrierName}, ${stopsText}, for ${money(offer.price.total)}${offer.tripType === "round-trip" ? " round trip" : ""}.`,
    "",
    "Want me to book it?",
  ].join("\n")

  return {
    events: [
      reading,
      extracting,
      { delay: 500, event: { kind: "progress", step: "search", from: origin, to: destination, departDate: depart, returnDate: ret } },
      { delay: 2600, event: { kind: "progress", step: "compare", count: offer.resultsCount ?? null } },
      step("choose", 700),
      reply(response, { offer, canBook: true }, 600),
    ],
    next,
  }
}

export function encodeState(state: MockState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url")
}

export function decodeState(raw: string | undefined, cid: string): MockState {
  if (raw) {
    try {
      const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as MockState
      if (parsed && parsed.cid === cid) return parsed
    } catch {
      /* fall through to a fresh state */
    }
  }
  return { cid, step: "idle" }
}

export const MOCK_COOKIE = "pal_mock"
export const MOCK_TRIPS_COOKIE = "pal_mock_trips"
export const MOCK_CHARGE_USD = 0.01

function b64url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

/** An unsigned stand-in for a demo session. Mock mode only. */
export function mockDemoToken(): string {
  const claims = {
    firstName: "Demo",
    lastName: "Traveller",
    email: "demo-traveller@example.com",
    demo: true,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 23,
  }
  return `${b64url({ alg: "none", typ: "JWT" })}.${b64url(claims)}.mock`
}

/** A demo booking reference, the way Flyte Pal shows one. */
export function simulatedReference(orderId: string): string {
  const hex = Array.from(orderId).reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261)
  const more = Array.from(orderId).reverse().reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261)
  return `SIMULATED-${(hex.toString(16) + more.toString(16)).toUpperCase().padStart(12, "0").slice(0, 12)}`
}

export const SIMULATED_LOCATOR = "DEMO00"

/** A booked mock trip, kept small: the offer is rebuilt from it on read. */
export interface MockTrip {
  orderId: string
  cid: string
  origin: string
  destination: string
  depart: string
  ret: string | null
  budget: number | null
  at: string
}

/** A mock trip, as the trips screen shows it. */
export function mockTripView(trip: MockTrip): Trip {
  const offer = mockOffer({ cid: trip.cid, step: "paid", origin: trip.origin, destination: trip.destination, depart: trip.depart, ret: trip.ret, budget: trip.budget })
  const ref = simulatedReference(trip.orderId)
  return {
    id: ref,
    reference: ref,
    airlineRef: SIMULATED_LOCATOR,
    bookedAt: trip.at,
    confirmed: true,
    demo: true,
    legs: offer.legs.map((leg) => ({
      from: leg.from ?? null,
      to: leg.to ?? null,
      departAt: leg.departAt ?? null,
      arriveAt: leg.arriveAt ?? null,
      carrier: offer.carrierName ?? null,
      stops: leg.stops ?? 0,
    })),
    travellers: ["Demo Traveller"],
    charged: MOCK_CHARGE_USD,
    currency: "USD",
    conversationId: trip.cid,
  }
}
