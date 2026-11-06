/*
 * The landing page's sky: dawn in light mode, night in dark. One oversized
 * gradient layer drifts by transform only; stars twinkle by opacity only and
 * sit at deterministic positions (golden-ratio spacing), so the server and
 * the browser draw the same sky. Loops live in globals.css's one
 * reduced-motion block.
 */

const STARS = Array.from({ length: 46 }, (_, i) => ({
  left: ((i * 0.618034) % 1) * 100,
  top: ((i * 0.381966 + (i % 7) * 0.031) % 1) * 62,
  size: i % 9 === 0 ? 2.4 : i % 3 === 0 ? 1.6 : 1.1,
  delay: ((i * 0.7548) % 1) * 6,
}))

export function Sky() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="sky-layer loop-sky absolute -inset-[20%]" />
      <div className="absolute inset-0 hidden dark:block">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="loop-twinkle absolute rounded-full bg-white"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, opacity: 0.55 }}
          />
        ))}
      </div>
      <div className="dot-field absolute inset-x-0 top-0 h-[90svh] opacity-70" />
    </div>
  )
}
