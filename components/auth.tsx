"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export const PAL_MODE: "mock" | "live" = process.env.NEXT_PUBLIC_PAL_MODE === "live" ? "live" : "mock"

export type AuthStatus = "loading" | "signed-out" | "connecting" | "signed-in" | "error"

/*
 * The visitor's session. Today there is one way in: the shared demo traveller
 * (POST /api/session/demo). Another sign-in method would be one more function
 * here that ends in apply(), with its own server route that stores the
 * session the same way.
 */
interface AuthValue {
  mode: "mock" | "live"
  status: AuthStatus
  name: string | null
  error: string | null
  continueAsDemo: () => Promise<void>
  signOut: () => Promise<void>
}

interface SessionInfo {
  signedIn?: boolean
  name?: string | null
  detail?: string
}

const AuthContext = createContext<AuthValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth outside AuthProvider")
  return value
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [name, setName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((info: SessionInfo) => {
    if (info.signedIn) {
      setName(info.name ?? null)
      setError(null)
      setStatus("signed-in")
    } else {
      setStatus("signed-out")
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/session")
      .then((r) => r.json())
      .then((info: SessionInfo) => !cancelled && apply(info))
      .catch(() => !cancelled && setStatus("signed-out"))
    return () => {
      cancelled = true
    }
  }, [apply])

  const continueAsDemo = useCallback(async () => {
    setError(null)
    setStatus("connecting")
    try {
      const res = await fetch("/api/session/demo", { method: "POST" })
      const info = (await res.json().catch(() => ({}))) as SessionInfo
      if (res.ok && info.signedIn) apply(info)
      else {
        setError(info.detail || "The demo traveller isn't available right now.")
        setStatus("error")
      }
    } catch {
      setError("Couldn't reach Flyte Pal. Please try again.")
      setStatus("error")
    }
  }, [apply])

  const signOut = useCallback(async () => {
    await fetch("/api/session", { method: "DELETE" }).catch(() => {})
    setName(null)
    setStatus("signed-out")
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ mode: PAL_MODE, status, name, error, continueAsDemo, signOut }),
    [status, name, error, continueAsDemo, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
