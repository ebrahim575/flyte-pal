"use client"

import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

/** True when the OS asks for less motion, or ?rm=1 forces it. */
export function prefersReducedMotion() {
  return window.matchMedia(QUERY).matches || new URLSearchParams(window.location.search).get("rm") === "1"
}

export function useReducedMotionPreference() {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}
