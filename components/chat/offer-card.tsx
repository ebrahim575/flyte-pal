"use client"

import { motion } from "motion/react"
import { ArrowRight, Briefcase, Luggage, ShieldCheck } from "lucide-react"
import type { FlightOffer, Leg } from "@/lib/types"
import { clock, day, dayOffset, duration, money, stopsLabel } from "@/lib/format"
import { CountUp } from "@/components/chat/count-up"
import { Button } from "@/components/ui/button"

const EASE = [0.22, 1, 0.36, 1] as const

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
}
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

function LegRow({ leg, label }: { leg: Leg; label: string }) {
  const plus = dayOffset(leg.departAt, leg.arriveAt)
  const stops = leg.stops ?? 0
  return (
    <motion.div variants={item} className="rounded-2xl border border-hairline bg-background/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium tracking-wide uppercase">{label}</span>
        <span>{day(leg.departAt)}</span>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-4">
        <div>
          <p className="font-mono text-[1.05rem] leading-none font-semibold whitespace-nowrap sm:text-2xl">{clock(leg.departAt)}</p>
          <p className="mt-1.5 font-mono text-xs font-medium tracking-wider text-muted-foreground">{leg.from}</p>
        </div>
        <div className="min-w-0 text-center">
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{duration(leg.durationMinutes)}</p>
          <div className="relative my-1.5 h-px bg-border">
            <motion.span
              aria-hidden
              className="absolute inset-0 origin-left bg-gradient-to-r from-pal to-flyte"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
            />
            {Array.from({ length: stops }).map((_, i) => (
              <span
                key={i}
                className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
                style={{ left: `${((i + 1) / (stops + 1)) * 100}%` }}
              />
            ))}
          </div>
          <p className={stops ? "hidden truncate text-xs text-foreground sm:block" : "hidden truncate text-xs text-success sm:block"}>{stopsLabel(stops, leg.via)}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[1.05rem] leading-none font-semibold whitespace-nowrap sm:text-2xl">
            {clock(leg.arriveAt)}
            {plus > 0 && <sup className="ml-0.5 text-[0.6em] text-pal-text">+{plus}</sup>}
          </p>
          <p className="mt-1.5 font-mono text-xs font-medium tracking-wider text-muted-foreground">{leg.to}</p>
        </div>
      </div>
      <p className="mt-3 flex justify-between text-xs sm:hidden">
        <span className="text-muted-foreground">{duration(leg.durationMinutes)}</span>
        <span className={stops ? "text-foreground" : "text-success"}>{stopsLabel(stops, leg.via)}</span>
      </p>
    </motion.div>
  )
}

export function OfferCard({ offer, active, onBook }: { offer: FlightOffer; active: boolean; onBook: () => void }) {
  const outbound = offer.legs[0]
  const roundTrip = offer.tripType === "round-trip" || offer.legs.length > 1
  const carrier = offer.carrierName || outbound?.segments?.[0]?.carrierName || offer.carrier
  const fmt = (n: number) => money(n, offer.price.currency)

  return (
    <motion.article
      initial={{ opacity: 0, x: -36, y: 22, rotate: -1.5, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 210, damping: 24 }}
      className="float-card relative mt-3 w-full overflow-hidden rounded-3xl"
    >
      {/* The best fare gets one shine as it lands. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent dark:via-white/10"
        initial={{ x: "-120%", skewX: -18 }}
        animate={{ x: "420%" }}
        transition={{ duration: 1.1, delay: 0.9, ease: [0.45, 0, 0.25, 1] }}
      />
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Best fare to</p>
          <h3 className="mt-0.5 truncate text-lg font-semibold tracking-tight">
            {outbound?.toCity || outbound?.toName || outbound?.to}
          </h3>
        </div>
        {typeof offer.resultsCount === "number" && offer.resultsCount > 1 && (
          <span className="shrink-0 rounded-full bg-pal/10 px-2.5 py-1 text-xs font-medium text-pal-text">
            Best of <CountUp value={offer.resultsCount} format={(n) => String(Math.round(n))} />
          </span>
        )}
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-2.5 p-3 sm:p-4">
        {offer.legs.map((leg, i) => (
          <LegRow key={i} leg={leg} label={i === 0 ? "Outbound" : "Return"} />
        ))}

        <motion.div variants={item} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 pt-1 text-xs text-muted-foreground">
          {carrier && <span className="font-medium text-foreground">{carrier}</span>}
          {offer.baggage?.checked && (
            <span className="inline-flex items-center gap-1.5">
              <Luggage className="size-3.5" /> Checked {offer.baggage.checked}
            </span>
          )}
          {offer.baggage?.carryOn && (
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="size-3.5" /> Carry-on {offer.baggage.carryOn}
            </span>
          )}
          {offer.refundable && (
            <span className="inline-flex items-center gap-1.5 text-success">
              <ShieldCheck className="size-3.5" /> Refundable
            </span>
          )}
        </motion.div>
      </motion.div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-hairline bg-background/40 px-5 py-4">
        <div>
          <p className="text-[1.75rem] leading-none font-semibold tracking-tight">
            <CountUp value={offer.price.total} format={fmt} duration={1.1} delay={0.2} />
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">{roundTrip ? "Round trip" : "One way"} · 1 adult · taxes included</p>
        </div>
        {active && (
          <Button onClick={onBook} className="group h-11 rounded-full bg-pal px-5 text-white hover:bg-pal/90">
            Book this flight
            <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        )}
      </div>
    </motion.article>
  )
}
