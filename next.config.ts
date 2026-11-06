import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Vercel Hobby: once the image optimisation quota runs out, /_next/image
  // returns 402 and every next/image goes blank.
  images: { unoptimized: true },

  // Mock mode is decided by whether FLYTE_BACKEND_URL is set at build time.
  // The server routes re-check it at runtime; this copy only tells the
  // browser which UI to show.
  env: {
    NEXT_PUBLIC_PAL_MODE: process.env.FLYTE_BACKEND_URL ? "live" : "mock",
  },
}

export default nextConfig
