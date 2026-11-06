import { NextResponse } from "next/server"
import { NotConfigured, callFlyte, crossSite, isMock, notConfigured, refuseCrossSite } from "@/lib/server/flyte-api"
import { describeSession, storeSession } from "@/lib/server/session"
import { checkLimit, tooMany } from "@/lib/server/rate-limit"
import { adaptSession } from "@/lib/server/adapt"
import { mockDemoToken } from "@/lib/mock/engine"

/*
 * "Continue as demo traveller": one shared traveller for judges and visitors,
 * so nobody needs an account to try the full flow.
 */

const REFUSALS: Record<number, string> = {
  401: "Flyte Pal isn't connected to Flyte AI correctly. Please try again later.",
  403: "Flyte Pal isn't connected to Flyte AI correctly. Please try again later.",
  404: "The demo traveller isn't available on this server.",
  429: "Lots of people are trying the demo right now. Give it a few minutes and try again.",
  503: "The demo traveller isn't set up yet. Please try again a little later.",
}

export async function POST(request: Request) {
  if (crossSite(request)) return refuseCrossSite()
  const limited = checkLimit(request, "demoSession")
  if (limited) return tooMany(limited)

  if (isMock()) {
    const token = mockDemoToken()
    await storeSession(token)
    return NextResponse.json({ mode: "mock", ...describeSession(token) })
  }

  let response: Response
  try {
    response = await callFlyte(request, "demoSession", { method: "POST", withSession: false, signal: AbortSignal.timeout(20_000) })
  } catch (error) {
    if (error instanceof NotConfigured) return notConfigured()
    return NextResponse.json({ detail: "Couldn't reach Flyte AI. Please try again." }, { status: 502 })
  }
  const { token } = adaptSession(await response.json().catch(() => null))
  if (!response.ok || !token) {
    const status = response.ok ? 502 : response.status
    return NextResponse.json(
      { detail: REFUSALS[response.status] ?? "The demo traveller isn't available right now. Please try again." },
      { status: status === 401 || status === 403 ? 502 : status },
    )
  }
  await storeSession(token)
  return NextResponse.json({ mode: "live", ...describeSession(token) })
}
