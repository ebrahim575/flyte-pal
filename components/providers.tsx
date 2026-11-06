"use client"

import { useEffect, type ReactNode } from "react"
import { MotionConfig } from "motion/react"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useReducedMotionPreference } from "@/lib/use-reduced-motion"

export function Providers({ children }: { children: ReactNode }) {
  // ?rm=1 forces the reduced-motion path without touching OS settings.
  const reduce = useReducedMotionPreference()
  const forced = reduce && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  useEffect(() => {
    if (forced) document.documentElement.dataset.rm = "1"
  }, [forced])

  return (
    <ThemeProvider>
      <MotionConfig reducedMotion={forced ? "always" : "user"}>
        <TooltipProvider delayDuration={200}>
          <AuthProvider>{children}</AuthProvider>
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  )
}
