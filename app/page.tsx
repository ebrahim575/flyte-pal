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
