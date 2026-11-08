import { ViewTransition } from "react"
import Link from "next/link"
import { ArrowRight, Info } from "lucide-react"
import { SiteHeader, PoweredByFlyte } from "@/components/site-header"
import { Hero } from "@/components/landing/hero"
import { Sky } from "@/components/landing/sky"
import { Story } from "@/components/landing/story"
import { Why } from "@/components/landing/why"

// Videos are served from a CDN, not from this repo or the app host. Unset:
// the "Watch Flyte Pal" section is left out (a fresh clone has no media).
const MEDIA_URL = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "")
const media = (file: string) => `${MEDIA_URL}/videos/${file}`

export default function Home() {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <div className="relative isolate min-h-svh overflow-x-clip">
        <Sky />
        <SiteHeader />
        <main>
          <Hero />

          <Story />

          {MEDIA_URL && <section aria-labelledby="demo-title" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <h2 id="demo-title" className="text-[clamp(1.7rem,3.4vw,2.4rem)] font-semibold tracking-[-0.03em]">
              Watch Flyte Pal
            </h2>
            <video
              controls
              playsInline
              preload="none"
              poster={media("flyte-pal-demo.jpg")}
              aria-label="Flyte Pal demo: live flight search and PayPal sandbox checkout"
              className="mt-6 aspect-video w-full rounded-3xl border border-hairline bg-card"
            >
              <source src={media("flyte-pal-demo.mp4")} type="video/mp4" />
              <a href={media("flyte-pal-demo.mp4")}>Download the demo video</a>
            </video>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {[
                { name: "The product film", file: "flyte-pal-product-film", duration: "0:42", label: "Just say it" },
                { name: "The phone demo", file: "flyte-pal-phone-demo", duration: "1:17", label: "A closer look" },
                { name: "The short version", file: "flyte-pal-teaser", duration: "0:51", label: "In under a minute" },
              ].map((film) => (
                <article key={film.file} className={`overflow-hidden rounded-3xl border border-hairline bg-card/85 shadow-xl shadow-flyte/5 ${film.file === "flyte-pal-product-film" ? "md:col-span-2" : ""}`}>
                  <div className="flex items-end justify-between gap-4 p-6">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-flyte-text">{film.label}</p>
                      <h3 className="text-xl font-semibold tracking-tight">{film.name}</h3>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{film.duration}</span>
                  </div>
                  <video controls playsInline preload="none" poster={media(`${film.file}.jpg`)} aria-label={film.name} className="aspect-video w-full bg-black object-contain">
                    <source src={media(`${film.file}.mp4`)} type="video/mp4" />
                    <a href={media(`${film.file}.mp4`)}>Watch {film.name.toLowerCase()}</a>
                  </video>
                </article>
              ))}
            </div>
          </section>}

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
