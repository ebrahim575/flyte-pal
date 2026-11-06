/*
 * The part of a reply worth saying out loud. Replies are written for the
 * screen: markdown, summaries, cards. Read verbatim that is a minute of
 * "asterisk asterisk". This keeps the prose, drops the furniture, says a fare
 * card in one sentence, and stops once it has said enough; the full reply is
 * always on screen. Every spoken character is billed, the other reason for
 * the cap.
 */

import type { FlightOffer, PaymentAsk, Reply } from "@/lib/types"

/** Roughly 15 to 20 seconds of speech. */
export const MAX_SPOKEN_CHARS = 320

const ON_SCREEN = "The rest is on screen."

function spokenMoney(amount: number | null | undefined, currency = "USD"): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null
  if (currency === "USD" && amount > 0 && amount < 1) {
    const cents = Math.round(amount * 100)
    return cents === 1 ? "one cent" : `${cents} cents`
  }
  const whole = Math.round(amount) === amount || amount >= 100
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(whole ? Math.round(amount) : amount)
}

function spokenDay(iso?: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })
}

function spokenTime(iso?: string | null): string | null {
  const m = iso ? /T(\d{2}):(\d{2})/.exec(iso) : null
  if (!m) return null
  const h = Number(m[1])
  const min = m[2] === "00" ? "" : `:${m[2]}`
  return `${((h + 11) % 12) + 1}${min} ${h < 12 ? "AM" : "PM"}`
}

/** A fare card in one sentence: "The best is a nonstop from Chicago to Dubai on Thursday, December 24, leaving at 8:20 AM, for $711 round trip." */
export function offerSpeech(offer: FlightOffer): string | null {
  const leg = offer.legs?.[0]
  const price = spokenMoney(offer.price?.total, offer.price?.currency)
  if (!leg || !price) return null
  const stops = leg.stops ?? 0
  const kind = stops === 0 ? "a nonstop" : stops === 1 ? "a one-stop flight" : `a ${stops}-stop flight`
  const from = leg.fromName || leg.from
  const to = leg.toCity || leg.toName || leg.to
  const day = spokenDay(leg.departAt)
  const time = spokenTime(leg.departAt)
  const trip = offer.tripType === "round-trip" || offer.legs.length > 1 ? " round trip" : ""
  return `The best is ${kind}${from && to ? ` from ${from} to ${to}` : ""}${day ? ` on ${day}` : ""}${time ? `, leaving at ${time}` : ""}, for ${price}${trip}. Want me to book it?`
}

/** The payment step. Payment always needs a tap on the PayPal button; voice never pays. */
export function paymentSpeech(payment: PaymentAsk): string {
  const charge = spokenMoney(payment.charge, payment.currency)
  return `Your booking is ready. Tap the PayPal button on screen to pay${charge ? `. It's a demo, so PayPal sandbox charges ${charge}` : ""}.`
}

/** What voice mode says for a reply. */
export function spokenReply(markdown: string, reply?: Reply | null): string {
  if (reply?.payment) return paymentSpeech(reply.payment)
  return (reply?.offer && offerSpeech(reply.offer)) || toSpeakable(markdown)
}

/** Markdown to plain spoken prose, uncapped. */
function clean(markdown: string): string {
  let t = markdown ?? ""
  t = t.replace(/```[\s\S]*?```/g, " ")
  t = t.replace(/<[^>]+>/g, " ")
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  t = t.replace(/https?:\/\/\S+/g, " ")
  t = t.replace(/^\s*\|.*\|\s*$/gm, " ")
  t = t.replace(/^\s{0,3}#{1,6}\s*/gm, "")
  t = t.replace(/^\s*>\s?/gm, "")
  t = t.replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
  t = t.replace(/(\*\*|__|\*|_|~~|`)/g, "")
  t = t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
  t = t.replace(/^[^\p{L}\p{N}\n]+$/gmu, "")
  t = t.replace(/[ \t]*\n[ \t]*(?=\p{Ll})/gu, " ")
  t = t.replace(/\s*\n+\s*/g, ". ")
  t = t.replace(/\s*(?:->|=>|→)\s*/g, " to ")
  t = t
    .replace(/\s+/g, " ")
    .replace(/(\.\s*){2,}/g, ". ")
    .replace(/([:;,!?])\s*\./g, (_, p) => (p === "!" || p === "?" ? p : "."))
    .trim()
  return t.replace(/^[.\s]+/, "")
}

/** A summary that ends in a question: say the question, the rest is on screen. */
export function toSpeakable(markdown: string, max = MAX_SPOKEN_CHARS): string {
  const t = clean(markdown)
  // A booking summary ("Traveller: ... Total: ... Reply yes to confirm"): the
  // fields are a list, so say only the ask at the end.
  const paras = (markdown ?? "").split(/\n\s*\n/).map(clean).filter((p) => /\p{L}/u.test(p))
  const looksLikeList = ((markdown ?? "").match(/^\s*(?:[-*+]|\*\*[^*]+:\*\*)/gm) ?? []).length >= 3
  if (looksLikeList && paras.length > 1) {
    const ask = paras.at(-1)!
    if (ask.length <= max) return `Here's the summary on screen. ${ask}`
  }
  if (t.length <= max) return t

  if (paras.at(-1)?.includes("?")) {
    const lead = "The details are on screen. "
    let tail = ""
    for (let i = paras.length - 1; i >= 0; i--) {
      const next = tail ? `${paras[i]} ${tail}` : paras[i]
      if (lead.length + next.length > max) break
      tail = next
    }
    if (tail) return lead + tail
  }

  const sentences = t.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [t]
  let out = ""
  for (const s of sentences) {
    if ((out + s).trim().length > max) break
    out += s
  }
  out = out.trim()
  if (!out) out = t.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:]$/, "") + "."
  return `${out} ${ON_SCREEN}`
}
