"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react"
import { CheckBurst, PayPalWave, Runway, ShieldDraw } from "@/components/paypal/checkout-motion"
import { useReducedMotionPreference } from "@/lib/use-reduced-motion"
import type { FlightOffer, PaymentAsk, PaymentOutcome, Trip } from "@/lib/types"
import { money } from "@/lib/format"
import { PAL_MODE } from "@/components/auth"
import dynamic from "next/dynamic"
import type { CheckoutHandlers } from "@/components/paypal/paypal-checkout"
import { SimulatedCheckout } from "@/components/paypal/simulated-checkout"
import { BoardingPass } from "@/components/chat/boarding-pass"
import { announce } from "@/lib/voice/voice"
import { Button } from "@/components/ui/button"

// PayPal's SDK downloads only when a payment step is on screen.
const PayPalCheckout = dynamic(() => import("@/components/paypal/paypal-checkout").then((m) => m.PayPalCheckout), {
  ssr: false,
  loading: () => (
    <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-muted text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" /> Loading PayPal
    </div>
  ),
})
const paypalConfigured = Boolean(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID)

type Phase = "choose" | "capturing" | "booking" | "takeoff" | "booked" | "failed"

const EASE = [0.22, 1, 0.36, 1] as const
const POLL_MS = 2000
const POLL_LIMIT_MS = 4 * 60 * 1000

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Request failed (${res.status})`)
  return data
}

/** The booking reference from the trip record, when the status didn't carry one. */
async function withTripReference(outcome: PaymentOutcome, conversationId: string): Promise<PaymentOutcome> {
  try {
    const res = await fetch("/api/trips")
    if (!res.ok) return outcome
    const data = (await res.json()) as { trips?: Trip[] }
    const trip = data.trips?.find((t) => t.conversationId === conversationId)
    if (!trip) return outcome
    return { ...outcome, reference: trip.reference ?? outcome.reference, airlineRef: outcome.airlineRef ?? trip.airlineRef }
  } catch {
    return outcome
  }
}

export function PaymentCard({
  conversationId,
  payment,
  offer,
  demo,
  travellerName,
}: {
  conversationId: string
  payment: PaymentAsk
  offer: FlightOffer | null
  demo: boolean
  travellerName: string | null
}) {
  // What PayPal actually charges: the payment request's amount from the
  // Flyte API. In the hackathon that is $0.01 in sandbox, whatever the fare.
  const amount = payment.charge
  const fare = offer?.price.total ?? null
  const demoCharge = fare !== null && amount + 0.005 < fare
  const [phase, setPhase] = useState<Phase>("choose")
  const [error, setError] = useState<string | null>(null)
  const [canRetry, setCanRetry] = useState(true)
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(null)
  const orderRef = useRef<string | null>(null)
  const reduce = useReducedMotionPreference()
  const reduceRef = useRef(reduce)
  useEffect(() => {
    reduceRef.current = reduce
  }, [reduce])
  const [polling, setPolling] = useState<string | null>(null)

  // After capture: ask what the payment ended as until it is booked or failed.
  useEffect(() => {
    if (!polling) return
    const orderId = polling
    const startedAt = Date.now()
    let timer = 0
    let cancelled = false
    const tick = async () => {
      let next = POLL_MS
      try {
        const qs = new URLSearchParams({ conversation_id: conversationId, order_id: orderId })
        const result = (await fetch(`/api/paypal/status?${qs}`).then((r) => r.json())) as PaymentOutcome
        if (cancelled) return
        if (result.state === "booked") {
          setOutcome(result.reference ? result : await withTripReference(result, conversationId))
          if (cancelled) return
          // Takeoff, once, then the boarding pass prints.
          if (!reduceRef.current) {
            setPhase("takeoff")
            await new Promise((r) => setTimeout(r, 1000))
            if (cancelled) return
          }
          setPhase("booked")
          announce("You're booked. It's a demo booking, so no real ticket is issued. You'll find it in Your trips.")
          return
        }
        if (result.state === "failed") {
          setError(result.message ?? "The booking didn't go through. Nothing was booked.")
          setCanRetry(result.retry === true)
          setPhase("failed")
          return
        }
      } catch {
        next = POLL_MS * 2
      }
      if (cancelled) return
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        setError("Your payment was received and the booking is still in progress. Check your Flyte AI orders in a few minutes, and please don't pay again.")
        setCanRetry(false)
        setPhase("failed")
        return
      }
      timer = window.setTimeout(tick, next)
    }
    timer = window.setTimeout(tick, POLL_MS / 2)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [polling, conversationId])

  const handlers: CheckoutHandlers = {
    createOrder: async () => {
      setError(null)
      const data = await postJson("/api/paypal/order", { conversation_id: conversationId })
      const orderId = data.orderId as string | undefined
      if (!orderId) throw new Error("No order came back")
      orderRef.current = orderId
      return { orderId }
    },
    onApprove: async (orderId) => {
      setPhase("capturing")
      try {
        await postJson("/api/paypal/capture", { conversation_id: conversationId, order_id: orderId })
      } catch (e) {
        setError(e instanceof Error ? e.message : "Payment capture failed")
        setCanRetry(true)
        setPhase("failed")
        return
      }
      setPhase("booking")
      setPolling(orderId)
    },
    onCancel: () => setError("Payment cancelled. You can try again whenever you're ready."),
    onError: (message) => setError(message),
  }

  const simulated = PAL_MODE === "mock" || !paypalConfigured

  return (
    <div className="mt-3 w-full">
      <AnimatePresence mode="wait" initial={false}>
        {phase === "booked" && outcome ? (
          <motion.div key="pass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
            <BoardingPass offer={offer} outcome={outcome} charged={amount} travellerName={travellerName} />
          </motion.div>
        ) : (
          <motion.section
            key="pay"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.25 } }}
            transition={{ duration: 0.55, ease: EASE }}
            className="float-card relative overflow-hidden rounded-3xl"
            aria-label="Payment"
            data-phase={phase}
          >
            {/* PayPal is handling this now: a navy-to-blue bar and one sweep. */}
            <motion.span
              aria-hidden
              className="pp-bar absolute inset-x-0 top-0 h-[3px] origin-left"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
            />
            <PayPalWave />
            <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
              <div>
                <p className="text-xs text-muted-foreground">{demoCharge ? "Fare" : "Total to pay"}</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{money(demoCharge ? fare : amount)}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pp-blue/10 px-2.5 py-1 text-xs font-medium text-pal-text">
                <ShieldDraw className="size-4" /> Secure checkout
              </span>
            </div>
            {(demoCharge || demo || PAL_MODE === "mock") && (
              <p className="mx-5 mb-4 rounded-xl bg-pal/8 px-3 py-2 text-xs leading-relaxed text-pal-text">
                <span className="font-semibold">Demo: you&apos;ll be charged {money(amount)} in PayPal sandbox.</span> No real money moves and no real ticket is issued.
              </p>
            )}

            <div className="relative px-5 pb-5">
              <AnimatePresence mode="wait" initial={false}>
                {phase === "choose" && (
                  <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pp-await p-1">
                    {simulated ? <SimulatedCheckout {...handlers} /> : <PayPalCheckout amount={amount} {...handlers} />}
                  </motion.div>
                )}
                {phase === "capturing" && (
                  <motion.div key="capturing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pp-await flex items-center gap-3 bg-muted px-4 py-4">
                    <LoaderCircle className="size-5 animate-spin text-pp-blue" />
                    <div>
                      <p className="text-sm font-medium">Confirming with PayPal</p>
                      <p className="text-xs text-muted-foreground">Hang tight, this takes a second.</p>
                    </div>
                  </motion.div>
                )}
                {(phase === "booking" || phase === "takeoff") && (
                  <motion.div key="booking" data-testid="payment-approved" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl bg-muted px-4 py-4">
                    <div className="flex items-center gap-3">
                      <CheckBurst size={40} />
                      <div>
                        <p className="text-sm font-medium">Payment approved</p>
                        <p className="text-xs text-muted-foreground">{phase === "takeoff" ? "Booked. Here's your pass." : "Booking your flight now."}</p>
                      </div>
                    </div>
                    <Runway phase={phase === "takeoff" ? "takeoff" : "taxi"} />
                  </motion.div>
                )}
                {phase === "failed" && (
                  <motion.div key="failed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-destructive/30 bg-destructive/8 p-4">
                    <p className="flex items-start gap-2 text-sm text-destructive">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                      {error}
                    </p>
                    {canRetry && (
                      <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => { setError(null); setPolling(null); setPhase("choose") }}>
                        <RotateCcw /> Try again
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              {phase === "choose" && error && <p className="mt-3 text-xs text-destructive">{error}</p>}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
