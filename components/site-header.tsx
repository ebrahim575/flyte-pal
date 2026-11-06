"use client"

import { useId } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { LogOut, LoaderCircle, FlaskConical, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { FlyteMark } from "@/components/flyte-mark"
import { useAuth } from "@/components/auth"
import { cn } from "@/lib/utils"

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Flyte Pal home">
      <FlyteMark className="size-8 text-foreground transition-transform duration-500 ease-out group-hover:rotate-[18deg]" />
      <span className="flex items-baseline gap-1.5 text-[1.05rem] leading-none font-semibold tracking-tight">
        Flyte
        <span className="rounded-md bg-pal/10 px-1.5 py-0.5 text-[0.95rem] font-medium text-pal-text">Pal</span>
      </span>
    </Link>
  )
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const maskId = `theme-moon-${useId().replace(/:/g, "")}`
  return (
    <Button
      variant="ghost"
      size="icon"
      className="theme-toggle relative size-10 rounded-full"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* One shape: the sun's rays tuck in and a shadow slides across to make the moon. */}
      <svg viewBox="0 0 24 24" className="size-[1.2rem]" aria-hidden>
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          <circle className="tt-bite" cx="24" cy="2" r="8" fill="black" />
        </mask>
        <circle className="tt-core" cx="12" cy="12" r="5" fill="currentColor" mask={`url(#${maskId})`} />
        <g className="tt-rays" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1="12" y1="2.5" x2="12" y2="4.5" transform={`rotate(${a} 12 12)`} />
          ))}
        </g>
      </svg>
    </Button>
  )
}

function ModePill() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-pal/40 px-2.5 text-xs font-medium text-pal-text sm:px-3">
          <FlaskConical className="size-3.5" />
          <span className="hidden sm:inline">Mock mode</span>
          <span className="sr-only sm:hidden">Mock mode</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>No backend configured. Fares, payment and booking are simulated.</TooltipContent>
    </Tooltip>
  )
}

function AccountButton() {
  const { mode, status, name, signOut } = useAuth()
  return (
    <>
      {mode === "mock" && <ModePill />}
      {status === "signed-in" ? (
        <>
          <Button asChild variant="ghost" size="sm" className="h-9 rounded-full px-3">
            <Link href="/trips" transitionTypes={["forward"]}>
              <Ticket />
              <span className="hidden sm:inline">Your trips</span>
              <span className="sr-only sm:hidden">Your trips</span>
            </Link>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 rounded-full px-3" onClick={signOut} aria-label="Sign out">
                <span className="hidden max-w-32 truncate sm:inline">{name ?? "Signed in"}</span>
                <LogOut />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sign out</TooltipContent>
          </Tooltip>
        </>
      ) : status === "connecting" ? (
        <Button variant="ghost" size="sm" className="h-9 rounded-full px-3" disabled>
          <LoaderCircle className="animate-spin" />
          <span className="hidden sm:inline">Signing in</span>
        </Button>
      ) : status === "loading" ? null : (
        <Button asChild size="sm" className="h-9 rounded-full bg-pal px-4 text-white hover:bg-pal/90">
          <Link href="/book">Sign in</Link>
        </Button>
      )}
    </>
  )
}

export function SiteHeader({ className }: { className?: string }) {
  return (
    <header className={cn("relative z-20 flex items-center justify-between gap-3 px-4 py-3 sm:px-6", className)}>
      <Wordmark />
      <div className="flex items-center gap-1 sm:gap-1.5">
        <AccountButton />
        <ThemeToggle />
      </div>
    </header>
  )
}

export function PoweredByFlyte({ className }: { className?: string }) {
  return (
    <a
      href="https://flyteai.io"
      target="_blank"
      rel="noopener"
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <span>Powered by</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/flyte-wordmark-light.svg" alt="Flyte AI" className="h-3.5 w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/flyte-wordmark-dark.svg" alt="Flyte AI" className="hidden h-3.5 w-auto dark:block" />
    </a>
  )
}
