import { ViewTransition } from "react"
import Link from "next/link"
import { ArrowRight, Info } from "lucide-react"
import { SiteHeader, PoweredByFlyte } from "@/components/site-header"
import { Hero } from "@/components/landing/hero"
import { Sky } from "@/components/landing/sky"
import { Story } from "@/components/landing/story"
import { Why } from "@/components/landing/why"

export default function Home() {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <div className="relative isolate min-h-svh overflow-x-clip">
        <Sky />
        <SiteHeader />
        <main>
          <Hero />

          <Story />

          <section aria-labelledby="demo-title" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <h2 id="demo-title" className="text-[clamp(1.7rem,3.4vw,2.4rem)] font-semibold tracking-[-0.03em]">
              Watch Flyte Pal
            </h2>
            <video
              controls
              playsInline
              preload="none"
              poster="/videos/flyte-pal-demo.jpg"
              aria-label="Flyte Pal demo: live flight search and PayPal sandbox checkout"
              className="mt-6 aspect-video w-full rounded-3xl border border-hairline bg-card"
            >
              <source src="/videos/flyte-pal-demo.mp4" type="video/mp4" />
              <a href="/videos/flyte-pal-demo.mp4">Download the demo video</a>
            </video>
          </section>

          <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
            <div className="reveal-on-scroll float-card mt-12 flex flex-col items-start gap-6 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div className="flex gap-3">
                <Info className="mt-0.5 size-5 shrink-0 text-pal-text" />
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">This is a demo.</span> Bookings are simulated and payments run in PayPal&apos;s sandbox. No real ticket is issued and no real money moves.
                </p>
              </div>
              <Link
                href="/book"
                transitionTypes={["forward"]}
                className="group inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-transform active:scale-[0.98]"
              >
                Try it now
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </section>
          <Why />
        </main>
        <footer className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 border-t border-hairline px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <PoweredByFlyte />
          <p>Flyte Pal is open source under the MIT license.</p>
        </footer>
      </div>
    </ViewTransition>
  )
}
