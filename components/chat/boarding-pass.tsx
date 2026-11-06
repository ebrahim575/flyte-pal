"use client"

import { useEffect } from "react"
import { motion, useAnimate, useReducedMotion } from "motion/react"
import Link from "next/link"
import { ArrowRight, Check, Plane } from "lucide-react"
import type { FlightOffer, PaymentOutcome } from "@/lib/types"
import { clock, day, money } from "@/lib/format"
import { PAL_MODE } from "@/components/auth"

/**
 * The booking confirmation. It prints out of a slot, then the DEMO stamp
 * lands. The shake fires at the stamp's moment of contact, not when its
 * animation settles.
 */
export function BoardingPass({
  offer,
  outcome,
  charged,
  travellerName,
}: {
  offer: FlightOffer | null
  outcome: PaymentOutcome
  /** What PayPal charged, from the payment request. Never the fare. */
  charged: number
  travellerName: string | null
}) {
  const [scope, animate] = useAnimate()
  const reduce = useReducedMotion()
  const out = offer?.legs[0]
  const back = offer?.legs[1]

  useEffect(() => {
    if (reduce) return
    let cancelled = false
    ;(async () => {
      await animate("[data-pass]", { y: ["-102%", "0%"] }, { duration: 1.05, ease: [0.16, 1, 0.3, 1] })
      if (cancelled) return
      animate("[data-stamp]", { scale: [2.6, 1], opacity: [0, 1], rotate: [-4, -11] }, { duration: 0.32, ease: [0.5, 0, 0.75, 0] })
      // Contact is at the end of an ease-in: shake on landing.
      await new Promise((r) => setTimeout(r, 300))
      if (cancelled) return
      animate("[data-pass]", { x: [0, -5, 4, -2, 0] }, { duration: 0.3 })
      animate("[data-check]", { pathLength: [0, 1] }, { duration: 0.5, delay: 0.1 })
    })()
    return () => {
      cancelled = true
    }
  }, [animate, reduce])

  return (
    <div ref={scope} className="relative">
      {/* The printer slot. */}
      <div aria-hidden className="mx-6 h-2 rounded-full bg-foreground/80 shadow-[0_6px_14px_-6px_rgb(0_0_0/0.5)]" />
      <div className="-mt-1 overflow-hidden px-2 pb-6">
        <article
          data-pass
          className="float-card relative rounded-3xl"
          aria-label="Demo booking confirmation"
          style={{ transform: reduce ? undefined : "translateY(-102%)" }}
        >
          <div className="flex items-center justify-between gap-3 rounded-t-3xl bg-gradient-to-r from-pal-deep via-pal to-flyte px-5 py-3.5 text-white">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <span className="grid size-6 place-items-center rounded-full bg-white/20">
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <motion.path data-check d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: reduce ? 1 : 0 }} />
                </svg>
              </span>
              Booked
            </span>
            <span className="rounded-full bg-white/18 px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase">Demo booking</span>
          </div>

          <div className="relative px-5 pt-5 pb-4">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[2.1rem] leading-none font-semibold tracking-tight sm:text-5xl">{out?.from ?? "---"}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{out?.fromName}</p>
              </div>
              <div className="flex flex-1 items-center gap-2 px-2 pb-6 text-pal">
                <span className="h-px flex-1 border-t border-dashed border-current opacity-50" />
                <Plane className="size-5 rotate-45" fill="currentColor" />
                <span className="h-px flex-1 border-t border-dashed border-current opacity-50" />
              </div>
              <div className="min-w-0 text-right">
                <p className="font-mono text-[2.1rem] leading-none font-semibold tracking-tight sm:text-5xl">{out?.to ?? "---"}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{out?.toCity || out?.toName}</p>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <Field label="Departs" value={out ? day(out.departAt) : "-"} sub={out ? clock(out.departAt) : undefined} />
              <Field label={back ? "Returns" : "Trip"} value={back ? day(back.departAt) : "One way"} sub={back ? clock(back.departAt) : undefined} />
              <Field label="Traveller" value={travellerName ?? "You"} />
              <Field label="Airline" value={offer?.carrierName ?? offer?.carrier ?? "-"} />
            </dl>

            <span
              data-stamp
              aria-hidden
              className="pointer-events-none absolute top-[3.1rem] left-1/2 -ml-[2.6rem] rotate-[-11deg] rounded-md border-2 border-pal-text/70 px-2 py-0.5 font-mono text-sm font-bold tracking-[0.2em] text-pal-text/80 uppercase sm:top-[3.4rem] sm:-ml-[3.4rem] sm:rounded-lg sm:border-[3px] sm:px-3 sm:py-1 sm:text-lg"
              style={{ opacity: reduce ? 1 : 0 }}
            >
              Demo
            </span>
          </div>

          <div aria-hidden className="perforation h-3" />

          <div className="flex flex-col items-start gap-4 px-5 pt-3 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <dl className="grid w-full min-w-0 grid-cols-2 gap-x-6 sm:w-auto sm:flex-1 gap-y-3 text-sm sm:grid-cols-3">
              <Field label="Booking ref" value={outcome.reference ?? "Not issued yet"} mono wrap muted={!outcome.reference} />
              <Field label="Airline ref" value={outcome.airlineRef ?? "-"} mono />
              <Field label="Fare" value={offer ? money(offer.price.total, offer.price.currency) : "-"} mono />
            </dl>
            <Link
              href="/trips"
              transitionTypes={["forward"]}
              className="group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-medium text-background"
            >
              View your trips
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>
          <p className="flex items-start gap-1.5 border-t border-hairline px-5 py-3 text-xs leading-relaxed text-muted-foreground">
            <Check className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">Demo: charged {money(charged)} in PayPal sandbox.</span>{" "}
              {PAL_MODE === "mock"
                ? "In mock mode that charge is simulated too, and no ticket exists."
                : "The booking is simulated, so no real ticket is issued."}
            </span>
          </p>
        </article>
      </div>
    </div>
  )
}

function Field({ label, value, sub, mono, wrap, muted }: { label: string; value: string; sub?: string; mono?: boolean; wrap?: boolean; muted?: boolean }) {
  return (
    <div className={wrap ? "col-span-2 min-w-0 sm:col-span-1" : "min-w-0"}>
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd
        className={[
          "mt-0.5",
          wrap ? "break-all" : "truncate",
          mono ? "font-mono font-semibold" : "font-medium",
          muted ? "font-normal text-muted-foreground" : "",
        ].join(" ")}
      >
        {value}
      </dd>
      {sub && <dd className="truncate font-mono text-xs text-muted-foreground">{sub}</dd>}
    </div>
  )
}
