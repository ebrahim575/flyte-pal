import "server-only"
import { cookies } from "next/headers"

/*
 * The Flyte AI API: server to server, authenticated. Where it lives, which
 * paths it answers on and how this server authenticates all come from the
 * deployment's environment, never from this repository.
 *
 *   FLYTE_BACKEND_URL       base URL. Unset: everything runs on the built-in mock.
 *   FLYTE_API_ROUTES        JSON object, one path per operation (see ROUTE_NAMES).
 *   FLYTE_API_KEY           this deployment's API key.
 *   FLYTE_API_KEY_HEADER    the header the key travels in.
 *   FLYTE_CLIENT_IP_HEADER  optional: forwards the visitor's IP for per-visitor limits.
 */

export const ROUTE_NAMES = ["chat", "demoSession", "trips", "paypalOrder", "paypalCapture", "paypalStatus"] as const
export type RouteName = (typeof ROUTE_NAMES)[number]

export const SESSION_COOKIE = "pal_session"

export function backendUrl(): string | null {
  const url = process.env.FLYTE_BACKEND_URL?.trim()
  return url ? url.replace(/\/+$/, "") : null
}

/** No backend configured: every route answers from the built-in mock. */
export function isMock(): boolean {
  return backendUrl() === null
}

interface LiveConfig {
  base: string
  routes: Record<RouteName, string>
  key: string
  keyHeader: string
  ipHeader: string | null
}

let cached: { config: LiveConfig | null; problem: string | null } | null = null

/** Live settings, or what is missing. Read once per server instance. */
function liveConfig(): { config: LiveConfig | null; problem: string | null } {
  if (cached) return cached
  const base = backendUrl()
  const missing: string[] = []
  let routes: Partial<Record<RouteName, string>> = {}
  try {
    routes = JSON.parse(process.env.FLYTE_API_ROUTES || "{}")
  } catch {
    missing.push("FLYTE_API_ROUTES (not valid JSON)")
  }
  for (const name of ROUTE_NAMES) {
    const path = routes[name]
    if (typeof path !== "string" || !path.startsWith("/")) missing.push(`FLYTE_API_ROUTES.${name}`)
  }
  const key = process.env.FLYTE_API_KEY?.trim()
  const keyHeader = process.env.FLYTE_API_KEY_HEADER?.trim()
  if (!key) missing.push("FLYTE_API_KEY")
  if (!keyHeader) missing.push("FLYTE_API_KEY_HEADER")
  cached =
    base && !missing.length
      ? {
          config: { base, routes: routes as Record<RouteName, string>, key: key!, keyHeader: keyHeader!, ipHeader: process.env.FLYTE_CLIENT_IP_HEADER?.trim() || null },
          problem: null,
        }
      : { config: null, problem: base ? `Live mode is missing: ${missing.join(", ")}` : null }
  if (cached.problem) console.error(`[flyte-pal] ${cached.problem}`)
  return cached
}

/** Thrown when live mode is switched on but not fully configured. */
export class NotConfigured extends Error {}

function visitorIp(request: Request): string | null {
  const real = request.headers.get("x-real-ip")?.trim()
  if (real) return real
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
}

export async function sessionToken(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(SESSION_COOKIE)?.value || null
}

/**
 * Call one Flyte AI API operation on behalf of this request, with this
 * server's credentials and, unless told otherwise, the visitor's session.
 */
export async function callFlyte(
  request: Request,
  route: RouteName,
  init: RequestInit & { withSession?: boolean; query?: Record<string, string> } = {},
): Promise<Response> {
  const { config, problem } = liveConfig()
  if (!config) throw new NotConfigured(problem ?? "Live mode is not configured")

  const headers: Record<string, string> = { [config.keyHeader]: config.key }
  if (init.body !== undefined) headers["Content-Type"] = "application/json"
  if (init.withSession !== false) {
    const token = await sessionToken()
    if (token) headers["Authorization"] = `Bearer ${token}`
  }
  const ip = visitorIp(request)
  if (ip && config.ipHeader) headers[config.ipHeader] = ip

  const qs = init.query ? `?${new URLSearchParams(init.query)}` : ""
  const { withSession: _w, query: _q, ...rest } = init
  void _w
  void _q
  return fetch(`${config.base}${config.routes[route]}${qs}`, { ...rest, headers, cache: "no-store" })
}

/** The unverified payload of the session token, for display only. */
export function sessionClaims(token: string | null): Record<string, unknown> | null {
  if (!token) return null
  const part = token.split(".")[1]
  if (!part) return null
  try {
    return JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"))
  } catch {
    return null
  }
}

/** Refuse a state-changing request sent from another site. */
export function crossSite(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return false
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

export function refuseCrossSite() {
  return Response.json({ detail: "Cross-site request refused" }, { status: 403 })
}

export function notConfigured() {
  return Response.json({ detail: "Flyte Pal isn't fully configured on this server." }, { status: 503 })
}

const CONVERSATION_ID = /^[A-Za-z0-9_-]{8,96}$/

export function validConversationId(value: unknown): value is string {
  return typeof value === "string" && CONVERSATION_ID.test(value)
}
