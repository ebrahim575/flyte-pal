"use client"

import { useEffect, useRef, useState, ViewTransition } from "react"
import Link from "next/link"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { SplitText } from "gsap/SplitText"
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin"
import { MotionPathPlugin } from "gsap/MotionPathPlugin"
import { ArrowRight, ArrowUp, Check, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useReducedMotionPreference } from "@/lib/use-reduced-motion"

gsap.registerPlugin(useGSAP, SplitText, DrawSVGPlugin, MotionPathPlugin)

const DEMOS = [
  { prompt: "Dubai, last week of December, under $900", from: "ORD", to: "DXB", fare: "$742", note: "Nonstop" },
  { prompt: "Lisbon in March for five nights", from: "JFK", to: "LIS", fare: "$518", note: "Nonstop" },
  { prompt: "Tokyo next month, window seat please", from: "SFO", to: "HND", fare: "$894", note: "1 stop" },
]

const CYCLE_MS = 6400
const ARC = "M 70 232 C 150 90, 340 30, 468 96"
// Lucide "plane", re-centred and turned to face along the path.
const PLANE =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"

/** One interval, one counter: the typewriter. */
function useTypewriter(text: string, run: boolean) {
  const [state, setState] = useState({ text, n: 0 })
  useEffect(() => {
    if (!run) return
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setState({ text, n: i })
      if (i >= text.length) window.clearInterval(id)
    }, 38)
    return () => window.clearInterval(id)
  }, [text, run])
  if (!run) return text
  return state.text === text ? text.slice(0, state.n) : ""
}

export function Hero() {
  const root = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const animated = !useReducedMotionPreference()
  const demo = DEMOS[index]
  const typed = useTypewriter(demo.prompt, animated)
  const doneTyping = typed.length === demo.prompt.length

  useEffect(() => {
    if (!animated) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % DEMOS.length), CYCLE_MS)
    return () => window.clearInterval(id)
  }, [animated])

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(
        { motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" },
        (ctx) => {
          const reduce = ctx.conditions?.reduce || new URLSearchParams(window.location.search).get("rm") === "1"
          if (reduce) {
            gsap.set(["[data-hero-in]", "[data-hero-title]"], { autoAlpha: 1, y: 0 })
            gsap.set("#hero-plane", { motionPath: { path: "#hero-arc", align: "#hero-arc", alignOrigin: [0.5, 0.5], autoRotate: true, start: 0.62, end: 0.62 } })
            return
          }
          const split = SplitText.create("[data-hero-title]", { type: "lines,words", mask: "lines", linesClass: "pb-[0.06em]" })
          const tl = gsap.timeline({ defaults: { ease: "expo.out" } })
          tl.set("[data-hero-title]", { autoAlpha: 1 })
            .from(split.words, { yPercent: 115, duration: 1.1, stagger: 0.045 })
            .from("[data-hero-in]", { autoAlpha: 0, y: 18, duration: 0.9, stagger: 0.08 }, "-=0.75")
            .from("#hero-track", { drawSVG: "0%", duration: 1.4, ease: "power2.inOut" }, 0.25)
            .from("[data-pin]", { scale: 0, transformOrigin: "50% 50%", duration: 0.6, stagger: 0.25, ease: "back.out(2.4)" }, 0.35)
            .from("[data-hero-card]", { autoAlpha: 0, y: 40, rotate: -2, duration: 1.1 }, 0.5)

          gsap
            .timeline({ repeat: -1, repeatDelay: 0.2, delay: 0.9 })
            .fromTo("#hero-trail", { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 3.6, ease: "power1.inOut" }, 0)
            .fromTo(
              "#hero-plane",
              { autoAlpha: 0 },
              {
                autoAlpha: 1,
                duration: 3.6,
                ease: "power1.inOut",
                motionPath: { path: "#hero-arc", align: "#hero-arc", alignOrigin: [0.5, 0.5], autoRotate: true },
              },
              0,
            )
            .to("#hero-plane", { autoAlpha: 0, duration: 0.3 }, 3.4)
            .to("#hero-trail", { drawSVG: "100% 100%", duration: 1.2, ease: "power2.in" }, 3.6)
            .to({}, { duration: CYCLE_MS / 1000 - 4.8 })

          return () => split.revert()
        },
      )
    },
    { scope: root },
  )

  return (
    <section ref={root} className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pt-12 lg:pb-24">
      <div className="relative z-10 min-w-0">
        <p data-hero-in className="mb-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="relative flex size-2">
            <span className="loop-pulse absolute inset-0 rounded-full bg-pal" />
            <span className="relative size-2 rounded-full bg-pal" />
          </span>
          AI travel agent with PayPal checkout
        </p>
        <h1
          data-hero-title
          className="invisible text-[clamp(2.6rem,7.2vw,5.4rem)] leading-[0.98] font-semibold tracking-[-0.045em] text-balance"
        >
          Say where you want to go. <span className="text-pal-text">Pay with PayPal.</span>
        </h1>
        <p data-hero-in className="mt-6 max-w-[34rem] text-[clamp(1rem,1.6vw,1.15rem)] leading-relaxed text-muted-foreground">
          Talk or type your trip. The Flyte AI agent searches global flight inventory, finds the best fare, and checks you out with PayPal, Venmo or Pay Later.
        </p>
        <div data-hero-in className="mt-9 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="group h-12 rounded-full bg-pal px-6 text-base text-white shadow-[0_12px_30px_-12px_var(--pal)] hover:bg-pal/90">
            <Link href="/book" transitionTypes={["forward"]}>
              Start booking
              <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="h-12 rounded-full px-5 text-base">
            <a href="#how">How it works</a>
          </Button>
        </div>
        <ul data-hero-in className="mt-10 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[0.78rem] tracking-wide text-muted-foreground uppercase">
          <li>PayPal</li>
          <li>Venmo</li>
          <li>Pay Later</li>
          <li className="text-flyte-text">Voice next</li>
        </ul>
      </div>

      <div className="relative min-w-0">
        <div aria-hidden className="relative mx-auto aspect-[520/360] w-full max-w-[560px]">
          <svg viewBox="0 0 520 360" className="absolute inset-0 size-full overflow-visible">
            <defs>
              <linearGradient id="arc-grad" x1="0" x2="1" y1="1" y2="0">
                <stop offset="0%" stopColor="var(--pal)" />
                <stop offset="100%" stopColor="var(--flyte)" />
              </linearGradient>
            </defs>
            <path id="hero-arc" d={ARC} fill="none" stroke="none" />
            <path id="hero-track" d={ARC} fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
            <path id="hero-trail" d={ARC} fill="none" stroke="url(#arc-grad)" strokeWidth="3" strokeLinecap="round" />
            {[
              { x: 70, y: 232, code: demo.from, dx: -24, dy: -24 },
              { x: 468, y: 96, code: demo.to, dx: -26, dy: -22 },
            ].map((p, i) => (
              <g key={i} data-pin>
                <circle cx={p.x} cy={p.y} r="16" fill="var(--pal)" opacity="0.14" />
                <circle cx={p.x} cy={p.y} r="6" fill="var(--card)" stroke="var(--pal)" strokeWidth="3" />
                <text x={p.x + p.dx} y={p.y + p.dy} className="fill-foreground font-mono text-[22px] font-semibold tracking-wider">
                  {p.code}
                </text>
              </g>
            ))}
            <g id="hero-plane" opacity="0">
              <g transform="translate(-14 -14) rotate(45 14 14) scale(1.16)">
                <path d={PLANE} fill="var(--pal)" stroke="var(--card)" strokeWidth="1.2" strokeLinejoin="round" />
              </g>
            </g>
          </svg>
        </div>

        <ViewTransition name="composer" share="morph" default="none">
          <div data-hero-card className="relative z-10 mx-auto -mt-10 w-full max-w-[440px] sm:-mt-16">
          <div
            className="tilt float-card rounded-3xl p-3"
            onPointerMove={(e) => {
              if (e.pointerType !== "mouse" || !animated) return
              const r = e.currentTarget.getBoundingClientRect()
              const px = (e.clientX - r.left) / r.width - 0.5
              const py = (e.clientY - r.top) / r.height - 0.5
              e.currentTarget.style.setProperty("--ry", `${(px * 10).toFixed(2)}deg`)
              e.currentTarget.style.setProperty("--rx", `${(-py * 8).toFixed(2)}deg`)
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.setProperty("--ry", "0deg")
              e.currentTarget.style.setProperty("--rx", "0deg")
            }}
          >
            <div className="flex min-h-12 items-center gap-2 rounded-2xl bg-background/60 py-1.5 pr-1.5 pl-4">
              <p className="min-w-0 flex-1 truncate text-[15px]">
                {typed}
                {!doneTyping && <span className="loop-caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-pal" />}
              </p>
              <span className="grid size-9 place-items-center rounded-full text-muted-foreground">
                <Mic className="size-4" />
              </span>
              <span className="grid size-9 place-items-center rounded-full bg-foreground text-background">
                <ArrowUp className="size-4" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 px-2 pt-3 pb-1 text-sm">
              <span
                key={`fare-${index}`}
                className="inline-flex items-center gap-2 font-mono text-[13px] text-muted-foreground transition-opacity duration-500"
                style={{ opacity: doneTyping ? 1 : 0 }}
              >
                {demo.from} <ArrowRight className="size-3" /> {demo.to}
                <span className="text-foreground">{demo.fare}</span>
                <span className="hidden sm:inline">· {demo.note}</span>
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-medium text-success transition-[opacity,transform] duration-500"
                style={{ opacity: doneTyping ? 1 : 0, transform: doneTyping ? "none" : "translateY(6px)", transitionDelay: doneTyping ? "700ms" : "0ms" }}
              >
                <Check className="size-3.5" /> Paid with PayPal
              </span>
            </div>
          </div>
          </div>
        </ViewTransition>
      </div>
    </section>
  )
}
