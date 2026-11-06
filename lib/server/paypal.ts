import "server-only"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { NotConfigured, callFlyte, notConfigured, type RouteName } from "@/lib/server/flyte-api"
import { MOCK_COOKIE, MOCK_TRIPS_COOKIE, decodeState, encodeState, type MockState, type MockTrip } from "@/lib/mock/engine"

/**
 * Call one Flyte AI API operation and hand back its JSON, or a plain-words
 * error response for the browser. Never passes the upstream body through.
 */
export async function flyteJson(
  request: Request,
  route: RouteName,
  init: Parameters<typeof callFlyte>[2],
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  let res: Response
  try {
    res = await callFlyte(request, route, { ...init, signal: AbortSignal.timeout(45_000) })
  } catch (error) {
    if (error instanceof NotConfigured) return { ok: false, response: notConfigured() }
    return { ok: false, response: NextResponse.json({ detail: "Couldn't reach Flyte AI. Please try again." }, { status: 502 }) }
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const detail =
      res.status === 401 || res.status === 403
        ? "Please sign in again."
        : res.status === 429
          ? "Lots of requests right now. Give it a minute and try again."
          : typeof data.detail === "string" && data.detail.length < 200
            ? data.detail
            : "That didn't go through. Please try again."
    return { ok: false, response: NextResponse.json({ detail }, { status: res.status }) }
  }
  return { ok: true, data }
}

export async function mockState(conversationId: string): Promise<MockState> {
  const jar = await cookies()
  return decodeState(jar.get(MOCK_COOKIE)?.value, conversationId)
}

export async function saveMockState(state: MockState) {
  const jar = await cookies()
  jar.set(MOCK_COOKIE, encodeState(state), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 6 })
}

export async function mockTrips(): Promise<MockTrip[]> {
  const jar = await cookies()
  const raw = jar.get(MOCK_TRIPS_COOKIE)?.value
  if (!raw) return []
  try {
    const list = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** Keep the last few mock trips; a cookie has room for about five. */
export async function addMockTrip(trip: MockTrip) {
  const list = (await mockTrips()).filter((t) => t.orderId !== trip.orderId)
  const next = [trip, ...list].slice(0, 5)
  const jar = await cookies()
  jar.set(MOCK_TRIPS_COOKIE, Buffer.from(JSON.stringify(next)).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}
