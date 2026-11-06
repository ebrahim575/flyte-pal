"use client"

import { useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin"
import { Check, Mic, Plane } from "lucide-react"
import { useReducedMotionPreference } from "@/lib/use-reduced-motion"
import { cn } from "@/lib/utils"

gsap.registerPlugin(useGSAP, ScrollTrigger, DrawSVGPlugin)

/*
 * "How it works" as one scroll-scrubbed story: talk, search, PayPal, booked.
 * On wide screens the section pins and the scenes play in a single device
 * frame as you scroll. On phones, and with reduced motion, the same four
 * scenes stack and simply reveal. GSAP owns every transform in here.
 */

const STEPS = [
  { code: "01", title: "Talk", body: "Say it or type it. Where, when, budget, seat, in plain words." },
  { code: "02", title: "Search", body: "The Flyte AI agent searches global flight inventory and lands on the best fare." },
  { code: "03", title: "Pay with PayPal", body: "PayPal, Venmo or Pay Later. PayPal handles the payment; nothing else touches it." },
  { code: "04", title: "Booked", body: "Your boarding pass prints, and the trip lands in Your trips." },
]

const WORDS = ["Dubai,", "last", "week", "of", "December,", "under", "$900"]

const FAN = [
  "M 40 200 Q 120 90 210 60",
  "M 40 200 Q 140 120 250 110",
  "M 40 200 Q 150 150 270 170",
  "M 40 200 Q 120 60 170 40",
  "M 40 200 Q 170 100 300 80",
]
const ROUTE = "M 40 200 Q 170 40 300 60"

function SceneTalk() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="relative grid size-20 place-items-center rounded-full bg-[radial-gradient(circle_at_32%_28%,rgb(255_255_255/0.7),transparent_36%),radial-gradient(circle_at_70%_78%,var(--flyte),transparent_60%),var(--pal)] text-white shadow-[0_18px_44px_-14px_var(--pal)]">
        <span data-ring className="absolute inset-0 rounded-full border-2 border-pal/60" />
        <Mic className="size-7" />
      </span>
      <p className="max-w-[16ch] text-2xl leading-tight font-semibold tracking-tight">
        {WORDS.map((w, i) => (
          <span key={i} data-word className="inline-block whitespace-pre">
            {w}{" "}
          </span>
        ))}
      </p>
    </div>
  )
}

function SceneSearch() {
  return (
    <div className="flex h-full flex-col justify-center px-5">
      <svg viewBox="0 0 340 240" className="w-full">
        {FAN.map((d, i) => (
          <path key={i} data-fan d={d} fill="none" stroke="var(--pal)" strokeWidth={1.4} strokeLinecap="round" opacity={0.4} />
        ))}
        <path data-route d={ROUTE} fill="none" stroke="var(--flyte)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={40} cy={200} r={6} fill="var(--card)" stroke="var(--pal)" strokeWidth={2.5} />
        <circle cx={300} cy={60} r={6} fill="var(--card)" stroke="var(--flyte)" strokeWidth={2.5} />
        <text x={22} y={228} className="fill-foreground font-mono text-[15px] font-semibold">ORD</text>
        <text x={282} y={40} className="fill-foreground font-mono text-[15px] font-semibold">DXB</text>
      </svg>
      <div data-fare className="float-card mx-auto -mt-2 flex items-center gap-3 rounded-2xl px-4 py-2.5">
        <span className="font-mono text-sm font-semibold">ORD → DXB</span>
        <span className="h-5 w-px bg-border" />
        <span className="text-lg font-semibold text-pal-text">$742</span>
        <span className="text-xs text-success">Nonstop</span>
      </div>
    </div>
  )
}

function ScenePay() {
  return (
    <div className="relative flex h-full flex-col justify-center gap-4 overflow-hidden px-6">
      <span data-wave aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-[200%]" style={{ background: "var(--pp-wave)" }} />
      <div className="pp-await relative rounded-2xl bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Secure checkout</p>
          <svg viewBox="0 0 24 24" className="size-6 text-pp-blue" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
            <path data-shield d="M12 2.8 4.5 5.6v5.9c0 4.6 3.1 8.4 7.5 9.7 4.4-1.3 7.5-5.1 7.5-9.7V5.6L12 2.8Z" />
          </svg>
        </div>
        <p className="mt-2 text-3xl font-semibold tracking-tight">$742.00</p>
        <p className="mt-1 text-xs text-muted-foreground">PayPal · Venmo · Pay Later</p>
        <div className="mt-5 flex items-center gap-3">
          <span className="relative grid size-10 place-items-center">
            <span data-ripple className="absolute inset-0 rounded-full border-2 border-pp-blue" />
            <span data-checkdisc className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(135deg, var(--pp-navy), var(--pp-blue) 60%, var(--pp-sky))" }} />
            <svg viewBox="0 0 24 24" className="relative size-5 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path data-check d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <p className="text-sm font-medium">Approved in PayPal</p>
        </div>
      </div>
    </div>
  )
}

function SceneBooked() {
  return (
    <div className="flex h-full flex-col justify-center px-6">
      <div data-pass className="float-card relative overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-pal-deep via-pal to-flyte px-4 py-2.5 text-white">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Check className="size-4" /> Booked
          </span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em]">DEMO BOOKING</span>
        </div>
        <div className="relative flex items-end justify-between px-4 pt-4 pb-5">
          <span className="font-mono text-4xl font-semibold">ORD</span>
          <Plane data-plane className="mb-2 size-5 rotate-45 text-pal" fill="currentColor" />
          <span className="font-mono text-4xl font-semibold">DXB</span>
          <span data-stamp className="absolute top-3 left-1/2 -ml-9 rotate-[-11deg] rounded-md border-2 border-pal-text/70 px-2 py-0.5 font-mono text-sm font-bold tracking-[0.2em] text-pal-text/80">
            DEMO
          </span>
        </div>
      </div>
    </div>
  )
}

const SCENES = [SceneTalk, SceneSearch, ScenePay, SceneBooked]

export function Story() {
  const root = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotionPreference()

  useGSAP(
    () => {
      if (reduce) return
      const mm = gsap.matchMedia()
      mm.add("(min-width: 768px)", () => {
        const pin = root.current!.querySelector<HTMLElement>("[data-story-pin]")!
        const q = gsap.utils.selector(pin)
        const scenes = q("[data-scene]")
        const steps = q("[data-step]")
        gsap.set(scenes.slice(1), { autoAlpha: 0, yPercent: 8 })
        gsap.set(steps.slice(1), { opacity: 0.35 })
        gsap.set(q("[data-word]"), { opacity: 0.12, y: 10 })
        gsap.set([...q("[data-fan]"), ...q("[data-route]")], { drawSVG: "0%" })
        gsap.set(q("[data-fare]"), { autoAlpha: 0, y: 16 })
        gsap.set(q("[data-wave]"), { xPercent: -55 })
        gsap.set(q("[data-shield]"), { drawSVG: "0%" })
        gsap.set(q("[data-check]"), { drawSVG: "0%" })
        gsap.set(q("[data-checkdisc]"), { scale: 0.3, autoAlpha: 0 })
        gsap.set(q("[data-ripple]"), { scale: 0.6, autoAlpha: 0 })
        gsap.set(q("[data-pass]"), { yPercent: 40, autoAlpha: 0 })
        gsap.set(q("[data-stamp]"), { scale: 2.4, autoAlpha: 0 })

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: pin, start: "top top", end: "+=2600", pin: true, scrub: 0.6 },
        })
        tl.to(q("[data-progress]"), { scaleY: 1, duration: 4 }, 0)
          // Talk
          .to(q("[data-word]"), { opacity: 1, y: 0, stagger: 0.08, duration: 0.25 }, 0.05)
          .to(q("[data-ring]"), { scale: 1.6, autoAlpha: 0, duration: 0.6 }, 0.1)
          // Search
          .to(scenes[0], { autoAlpha: 0, yPercent: -8, duration: 0.25 }, 0.95)
          .to(steps[0], { opacity: 0.35, duration: 0.2 }, 0.95)
          .to(steps[1], { opacity: 1, duration: 0.2 }, 0.95)
          .to(scenes[1], { autoAlpha: 1, yPercent: 0, duration: 0.25 }, 1)
          .to(q("[data-fan]"), { drawSVG: "100%", stagger: 0.08, duration: 0.4 }, 1.1)
          .to(q("[data-fan]"), { opacity: 0.08, duration: 0.2 }, 1.6)
          .to(q("[data-route]"), { drawSVG: "100%", duration: 0.35 }, 1.6)
          .to(q("[data-fare]"), { autoAlpha: 1, y: 0, duration: 0.2 }, 1.75)
          // PayPal
          .to(scenes[1], { autoAlpha: 0, yPercent: -8, duration: 0.25 }, 1.95)
          .to(steps[1], { opacity: 0.35, duration: 0.2 }, 1.95)
          .to(steps[2], { opacity: 1, duration: 0.2 }, 1.95)
          .to(scenes[2], { autoAlpha: 1, yPercent: 0, duration: 0.25 }, 2)
          .to(q("[data-wave]"), { xPercent: 55, duration: 0.6 }, 2.05)
          .to(q("[data-shield]"), { drawSVG: "100%", duration: 0.3 }, 2.15)
          .to(q("[data-checkdisc]"), { scale: 1, autoAlpha: 1, duration: 0.15 }, 2.5)
          .to(q("[data-check]"), { drawSVG: "100%", duration: 0.15 }, 2.58)
          .to(q("[data-ripple]"), { scale: 2, autoAlpha: 0, duration: 0.3, startAt: { autoAlpha: 0.9 } }, 2.6)
          // Booked
          .to(scenes[2], { autoAlpha: 0, yPercent: -8, duration: 0.25 }, 2.95)
          .to(steps[2], { opacity: 0.35, duration: 0.2 }, 2.95)
          .to(steps[3], { opacity: 1, duration: 0.2 }, 2.95)
          .to(scenes[3], { autoAlpha: 1, yPercent: 0, duration: 0.25 }, 3)
          .to(q("[data-pass]"), { yPercent: 0, autoAlpha: 1, duration: 0.35, ease: "power3.out" }, 3.05)
          .to(q("[data-stamp]"), { scale: 1, autoAlpha: 1, duration: 0.15, ease: "power2.in" }, 3.45)
          .to(q("[data-plane]"), { x: 10, y: -6, duration: 0.3 }, 3.5)
          .to({}, { duration: 0.3 })
      })
      return () => mm.revert()
    },
    { scope: root, dependencies: [reduce] },
  )

  return (
    <section id="how" ref={root} className="scroll-mt-8">
      {/* Pinned, scrubbed version: wide screens with motion. */}
      <div data-story-pin className={cn("mx-auto hidden h-svh w-full max-w-6xl items-center gap-12 px-6", !reduce && "md:grid md:grid-cols-[1fr_1.05fr]")}>
        <div>
          <h2 className="text-[clamp(1.8rem,3.6vw,2.8rem)] leading-tight font-semibold tracking-[-0.03em]">One conversation, start to gate.</h2>
          <div className="relative mt-10 pl-8">
            <span className="absolute top-1 bottom-1 left-[7px] w-px bg-border" />
            <span data-progress className="absolute top-1 bottom-1 left-[7px] w-px origin-top scale-y-0 bg-gradient-to-b from-pal to-pp-sky" />
            <ol className="space-y-8">
              {STEPS.map((s) => (
                <li key={s.code} data-step className="relative">
                  <span className="absolute top-1.5 -left-8 grid size-[15px] place-items-center rounded-full border-2 border-pal bg-background">
                    <span className="size-[5px] rounded-full bg-pal" />
                  </span>
                  <p className="font-mono text-xs tracking-[0.2em] text-pal-text">{s.code}</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1 max-w-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="float-card relative mx-auto aspect-[4/4.4] w-full max-w-[440px] overflow-hidden rounded-[2rem]">
          {SCENES.map((Scene, i) => (
            <div key={i} data-scene className="absolute inset-0">
              <Scene />
            </div>
          ))}
        </div>
      </div>

      {/* Stacked version: phones, and reduced motion everywhere. */}
      <div className={cn("mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6", !reduce && "md:hidden")}>
        <h2 className="reveal-on-scroll text-[clamp(1.8rem,3.6vw,2.6rem)] leading-tight font-semibold tracking-[-0.03em]">One conversation, start to gate.</h2>
        <ol className="mt-8 grid gap-10 md:grid-cols-2">
          {STEPS.map((s, i) => {
            const Scene = SCENES[i]
            return (
              <li key={s.code} className="reveal-on-scroll">
                <p className="font-mono text-xs tracking-[0.2em] text-pal-text">{s.code}</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1 text-muted-foreground">{s.body}</p>
                <div className="float-card relative mt-4 h-72 overflow-hidden rounded-3xl">
                  <Scene />
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
