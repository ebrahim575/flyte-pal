import { ArrowUpRight, Plane } from "lucide-react"

/*
 * Why we built this. Styled like a letter sent airmail: a striped edge, a
 * postmark, a plane drifting on its route. Motion is gentle and CSS only
 * (reveal on scroll, a slow float), and switches off with reduced motion.
 */
export function Why() {
  return (
    <section aria-labelledby="why-title" className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      <div className="reveal-on-scroll airmail relative overflow-hidden rounded-[2rem] p-[6px]">
        <div className="relative grid gap-8 rounded-[1.6rem] bg-card px-6 py-10 sm:px-10 sm:py-12 md:grid-cols-[auto_1fr] md:items-center md:gap-12">
          <div aria-hidden className="relative mx-auto grid size-36 shrink-0 place-items-center sm:size-44">
            <span className="absolute inset-0 rounded-full border-2 border-dashed border-flyte/45" />
            <span className="absolute inset-3 rounded-full border border-pal/35" />
            <span className="absolute inset-[22%] rounded-full bg-gradient-to-br from-flyte/15 to-pal/15" />
            <span className="loop-float text-pal-text">
              <Plane className="size-10 rotate-45 sm:size-12" fill="currentColor" strokeWidth={1.2} />
            </span>
          </div>
          <div className="max-w-2xl">
            <h2 id="why-title" className="text-[clamp(1.7rem,3.4vw,2.4rem)] leading-tight font-semibold tracking-[-0.03em]">
              Why we built this
            </h2>
            <p className="mt-5 text-[clamp(1.02rem,1.5vw,1.15rem)] leading-relaxed text-foreground/85">
              Booking flights has always been a little annoying. In our family, we were the ones everyone trusted to find them the best deal. Then we remembered our late grandfather started one of the first travel agencies in London. So we&apos;ve kind of come full circle: still getting people the best deal, just agentically now.
            </p>
            <a
              href="https://flyteai.io/about"
              target="_blank"
              rel="noopener"
              className="group mt-7 inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background/60 px-5 text-sm font-medium transition-[border-color,transform] duration-300 hover:border-flyte/50 active:scale-[0.98]"
            >
              Read the full story
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
