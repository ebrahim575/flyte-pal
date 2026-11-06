import { crossSite, refuseCrossSite } from "@/lib/server/flyte-api"
import { checkLimit, tooMany } from "@/lib/server/rate-limit"
import { ELEVEN_API, elevenKey, refuse, ttsModel, voiceId } from "@/lib/server/voice"
import { MAX_SPOKEN_CHARS } from "@/lib/voice/speakable"

/**
 * POST /api/voice/speak { text } -> NDJSON straight from ElevenLabs'
 * stream-with-timestamps: each line is { audio_base64, alignment }, the audio
 * 24 kHz 16-bit mono PCM, the alignment every character's start and end in
 * seconds. The browser plays the PCM through Web Audio and times the captions
 * from it.
 */

export const maxDuration = 60

/** The client trims to MAX_SPOKEN_CHARS plus a short tail; anything longer is not ours. */
const HARD_CAP = MAX_SPOKEN_CHARS + 80

export async function POST(request: Request) {
  if (crossSite(request)) return refuseCrossSite()
  const key = elevenKey()
  if (!key) return refuse(503, "Voice is off right now.")
  const limited = checkLimit(request, "voiceSpeak")
  if (limited) return tooMany(limited)

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  const text = typeof body?.text === "string" ? body.text.trim() : ""
  if (!text) return refuse(400, "Nothing to say.")
  if (text.length > HARD_CAP) return refuse(413, "Too long to speak.")

  const upstream = await fetch(
    `${ELEVEN_API}/v1/text-to-speech/${encodeURIComponent(voiceId())}/stream/with-timestamps?output_format=pcm_24000`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: ttsModel() }),
      // Cutting in drops this request, which stops generation upstream instead
      // of paying for audio nobody hears.
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    },
  ).catch(() => null)
  if (!upstream?.ok || !upstream.body) return refuse(502, "Couldn't speak that reply.")

  return new Response(upstream.body, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  })
}
