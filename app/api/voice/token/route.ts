import { NextResponse } from "next/server"
import { crossSite, refuseCrossSite } from "@/lib/server/flyte-api"
import { checkLimit, tooMany } from "@/lib/server/rate-limit"
import { ELEVEN_API, elevenKey, refuse } from "@/lib/server/voice"

/**
 * POST /api/voice/token -> { token }: a single-use ElevenLabs token that lets
 * this browser open one live transcription session. The API key stays here.
 */
export async function POST(request: Request) {
  if (crossSite(request)) return refuseCrossSite()
  const key = elevenKey()
  if (!key) return refuse(503, "Voice is off right now. You can keep typing.")
  const limited = checkLimit(request, "voiceToken")
  if (limited) return tooMany(limited)

  const upstream = await fetch(`${ELEVEN_API}/v1/single-use-token/realtime_scribe`, {
    method: "POST",
    headers: { "xi-api-key": key },
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null)
  const token = upstream?.ok ? ((await upstream.json().catch(() => null)) as { token?: string } | null)?.token : null
  if (!token) return refuse(502, "Couldn't start voice. Try again, or keep typing.")
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } })
}
