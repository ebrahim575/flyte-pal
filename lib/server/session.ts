import "server-only"
import { cookies } from "next/headers"
import { SESSION_COOKIE, sessionClaims } from "@/lib/server/flyte-api"

/** What the page may show about a session. Read unverified, for display only. */
export function describeSession(token: string | null) {
  const claims = sessionClaims(token)
  if (!claims) return { signedIn: false as const }
  const exp = typeof claims.exp === "number" ? claims.exp : null
  if (exp && exp * 1000 < Date.now()) return { signedIn: false as const }
  const first = typeof claims.firstName === "string" ? claims.firstName : null
  const last = typeof claims.lastName === "string" ? claims.lastName : null
  return {
    signedIn: true as const,
    name: [first, last].filter(Boolean).join(" ") || null,
  }
}

export async function storeSession(token: string) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 23,
  })
}
