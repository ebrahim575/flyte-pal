import "server-only"

/*
 * Voice runs on ElevenLabs. The API key never leaves this server: the browser
 * gets a single-use transcription token, and speech comes through our route.
 */

export const ELEVEN_API = "https://api.elevenlabs.io"

/** Kiwi. Override with ELEVENLABS_VOICE_ID. */
export const DEFAULT_VOICE_ID = "VEWZvLXUrFL3O7dUnBSW"

/** ElevenLabs' ultra-low-latency conversational model. Override with ELEVENLABS_TTS_MODEL. */
export const DEFAULT_TTS_MODEL = "eleven_flash_v2_5"

/** ELEVENLABS_VOICE_ENABLED=false switches voice off without a redeploy of code. */
export function voiceDisabled(): boolean {
  return process.env.ELEVENLABS_VOICE_ENABLED === "false"
}

export function elevenKey(): string | null {
  if (voiceDisabled()) return null
  return process.env.ELEVENLABS_API_KEY?.trim() || null
}

export function voiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID
}

export function ttsModel(): string {
  return process.env.ELEVENLABS_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL
}

export function refuse(status: number, detail: string) {
  return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } })
}
