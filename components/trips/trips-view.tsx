"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight, Plane, PlaneTakeoff, RotateCcw, TriangleAlert } from "lucide-react"
import { SiteHeader, PoweredByFlyte } from "@/components/site-header"
import { useAuth } from "@/components/auth"
import { Button } from "@/components/ui/button"
import { clock, day, money } from "@/lib/format"
import type { Trip } from "@/lib/types"

const EASE = [0.22, 1, 0.36, 1] as const

type Load = { state: "loading" } | { state: "ready"; trips: Trip[] } | { state: "error"; message: string }

export function TripsView() {
  const auth = useAuth()
  const [load, setLoad] = useState<Load>({ state: "loading" })
  const [attempt, setAttempt] = useState(0)
  const signedIn = auth.status === "signed-in"

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    fetch("/api/trips")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) setLoad({ state: "error", message: (data as { detail?: string }).detail || "Couldn't load your trips." })
        else setLoad({ state: "ready", trips: (data as { trips?: Trip[] }).trips ?? [] })
      })
      .catch(() => !cancelled && setLoad({ state: "error", message: "Couldn't reach Flyte Pal. Please try again." }))
    return () => {
      cancelled = true
    }
  }, [signedIn, attempt])

  return (
    <div className="relative isolate min-h-svh">
      <div aria-hidden className="glow-field pointer-events-none fixed inset-0 -z-10 opacity-70" />
      <SiteHeader className="border-b border-hairline bg-background/70 backdrop-blur-md" />
      <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-[clamp(2rem,5vw,2.8rem)] leading-tight font-semibold tracking-[-0.035em]"
            >
              Your trips
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06, ease: EASE }}
              className="mt-2 text-muted-foreground"
            >
              Shared demo account: trips from everyone trying Flyte Pal, newest first. Nothing here is private.
            </motion.p>
          </div>
          <Button asChild className="h-10 rounded-full bg-pal px-4 text-white hover:bg-pal/90">
            <Link href="/book" transitionTypes={["back"]}>
              <PlaneTakeoff /> Book a flight
            </Link>
          </Button>
        </div>

        <div className="mt-8">
          {auth.status === "loading" || (signedIn && load.state === "loading") ? (
            <div className="space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-3xl bg-muted" />
              ))}
            </div>
          ) : !signedIn ? (
            <Notice
              title="Sign in to see your trips"
              body="Continue as the demo traveller and your bookings show up here."
              action={
                <Button asChild className="h-11 rounded-full px-5">
                  <Link href="/book">
                    Go to sign in <ArrowRight />
                  </Link>
                </Button>
              }
            />
          ) : load.state === "error" ? (
            <Notice
              title="Couldn't load your trips"
              body={load.message}
              icon={<TriangleAlert className="size-5 text-destructive" />}
              action={
                <Button variant="outline" className="h-10 rounded-full" onClick={() => { setLoad({ state: "loading" }); setAttempt((n) => n + 1) }}>
                  <RotateCcw /> Try again
                </Button>
              }
            />
          ) : load.state === "ready" && load.trips.length === 0 ? (
            <Notice
              title="No trips yet"
              body="Tell the agent where you want to go and your first booking lands here."
              icon={<Plane className="size-5 text-pal-text" />}
              action={
                <Button asChild className="h-11 rounded-full bg-pal px-5 text-white hover:bg-pal/90">
                  <Link href="/book">Plan a trip <ArrowRight /></Link>
                </Button>
              }
            />
          ) : load.state === "ready" ? (
            <motion.ol
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
              className="space-y-4"
            >
              {load.trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </motion.ol>
          ) : null}
        </div>

        <div className="mt-12">
          <PoweredByFlyte />
        </div>
      </main>
    </div>
  )
}

function TripCard({ trip }: { trip: Trip }) {
  const out = trip.legs[0]
  const back = trip.legs[1]
  return (
    <motion.li
      variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}
      className="float-card overflow-hidden rounded-3xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-5 py-3">
        <div className="flex items-center gap-2">
          {trip.demo ? (
            <span className="rounded-full bg-pal/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-[0.16em] text-pal-text uppercase">
              Demo booking
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">Flyte AI booking</span>
          )}
          <span className={trip.confirmed ? "text-xs font-medium text-success" : "text-xs font-medium text-muted-foreground"}>
            {trip.confirmed ? "Confirmed" : "Pending"}
          </span>
        </div>
        {trip.bookedAt && <span className="text-xs text-muted-foreground">Booked {day(trip.bookedAt)}</span>}
      </div>

      <div className="grid gap-5 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-3xl font-semibold tracking-tight">{out?.from ?? "---"}</span>
            <span className="flex flex-1 items-center gap-2 text-pal sm:max-w-40">
              <span className="h-px flex-1 border-t border-dashed border-current opacity-50" />
              <Plane className="size-4 rotate-45" fill="currentColor" />
              <span className="h-px flex-1 border-t border-dashed border-current opacity-50" />
            </span>
            <span className="font-mono text-3xl font-semibold tracking-tight">{out?.to ?? "---"}</span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Item label="Departs" value={out ? day(out.departAt) : "-"} sub={out?.departAt ? clock(out.departAt) : undefined} />
            <Item label={back ? "Returns" : "Trip"} value={back ? day(back.departAt) : "One way"} sub={back?.departAt ? clock(back.departAt) : undefined} />
            <Item label="Traveller" value={trip.travellers.join(", ") || "-"} />
            <Item label="Airline" value={out?.carrier ?? "-"} />
          </dl>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl bg-background/60 p-4 text-sm sm:w-56">
          <Item label="Booking ref" value={trip.reference ?? "Not issued yet"} mono wrap />
          <Item label="Airline ref" value={trip.airlineRef ?? "-"} mono />
          {trip.charged !== null && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {trip.demo ? (
                <>
                  <span className="font-medium text-foreground">Demo:</span> charged {money(trip.charged, trip.currency)} in PayPal sandbox
                </>
              ) : (
                <>Paid {money(trip.charged, trip.currency)}</>
              )}
            </p>
          )}
        </div>
      </div>
    </motion.li>
  )
}

function Item({ label, value, sub, mono, wrap }: { label: string; value: string; sub?: string; mono?: boolean; wrap?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={`mt-0.5 ${wrap ? "break-all" : "truncate"} ${mono ? "font-mono font-semibold" : "font-medium"}`}>{value}</dd>
      {sub && <dd className="font-mono text-xs text-muted-foreground">{sub}</dd>}
    </div>
  )
}

function Notice({ title, body, action, icon }: { title: string; body: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="float-card max-w-lg rounded-3xl p-6"
    >
      {icon && <div className="mb-3 grid size-10 place-items-center rounded-full bg-muted">{icon}</div>}
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}
