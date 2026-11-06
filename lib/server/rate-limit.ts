import "server-only"

/*
 * Per-IP rate limits for Flyte Pal's own routes, a sliding window kept in
 * memory. On Vercel each warm function instance keeps its own counts, so a
 * determined client spread across instances gets more; the Flyte API keeps
 * its own limits behind this one.
 */

export const LIMITS = {
  demoSession: { max: 10, windowMs: 60 * 60 * 1000, message: "Too many demo sign-ins from your network. Try again in a little while." },
  chat: { max: 40, windowMs: 10 * 60 * 1000, message: "You're sending messages faster than the agent can keep up. Give it a few minutes and try again." },
  paypal: { max: 20, windowMs: 60 * 60 * 1000, message: "Too many payment attempts from your network. Try again in a little while." },
  voiceToken: { max: 20, windowMs: 60 * 60 * 1000, message: "Too many voice sessions from your network. Try again in a little while, or keep typing." },
  voiceSpeak: { max: 200, windowMs: 60 * 60 * 1000, message: "Too many spoken replies from your network. Replies stay on screen." },
} as const

export type LimitName = keyof typeof LIMITS

const hits = new Map<string, number[]>()
let lastSweep = Date.now()

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  )
}

/** Null when allowed; otherwise how long until the next request is. */
export function checkLimit(request: Request, name: LimitName): { retryAfter: number; message: string } | null {
  const { max, windowMs, message } = LIMITS[name]
  const now = Date.now()
  if (now - lastSweep > 5 * 60 * 1000) {
    for (const [key, list] of hits) if (!list.length || now - list[list.length - 1] > 60 * 60 * 1000) hits.delete(key)
    lastSweep = now
  }
  const key = `${name}:${clientIp(request)}`
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (list.length >= max) {
    hits.set(key, list)
    return { retryAfter: Math.ceil((list[0] + windowMs - now) / 1000), message }
  }
  list.push(now)
  hits.set(key, list)
  return null
}

export function tooMany(limit: { retryAfter: number; message: string }) {
  return Response.json(
    { detail: limit.message, rate_limited: true },
    { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
  )
}
