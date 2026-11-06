import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { SESSION_COOKIE, crossSite, isMock, refuseCrossSite, sessionToken } from "@/lib/server/flyte-api"
import { describeSession } from "@/lib/server/session"

/** The visitor's session, kept in an httpOnly cookie. Signing in is /api/session/demo. */
export async function GET() {
  return NextResponse.json({ mode: isMock() ? "mock" : "live", ...describeSession(await sessionToken()) })
}

export async function DELETE(request: Request) {
  if (crossSite(request)) return refuseCrossSite()
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
  return NextResponse.json({ signedIn: false })
}
