import { NextResponse } from "next/server"
import { elevenKey, voiceDisabled } from "@/lib/server/voice"

/** Which voice the browser should use: ElevenLabs, or none (it may fall back to its own). */
export async function GET() {
  return NextResponse.json(
    { elevenlabs: Boolean(elevenKey()), disabled: voiceDisabled() },
    { headers: { "Cache-Control": "no-store" } },
  )
}
