import type { Progress, ProgressStep } from "@/lib/types"
import { day } from "@/lib/format"

/** Plain words for what the agent is doing. */
const LABELS: Record<ProgressStep, string> = {
  read: "Reading your message",
  understand: "Working out the trip",
  search: "Searching global flight inventory",
  compare: "Comparing fares",
  choose: "Picking the best option",
  verify: "Checking the fare is still live",
  book: "Getting your booking ready",
  working: "Working on it",
}

export function stageLabel(p: Progress): string {
  return LABELS[p.step] ?? LABELS.working
}

export function stageDetail(p: Progress): string | null {
  if (p.step === "search") {
    const route = [p.from, p.to].filter(Boolean).join(" to ")
    const dates = [p.departDate, p.returnDate].filter((x): x is string => !!x).map((x) => day(x)).join(" - ")
    return [route, dates].filter(Boolean).join(" · ") || null
  }
  if (p.step === "compare" && typeof p.count === "number") return `${p.count} fares found`
  return null
}

/** The searching step carries the route, for the search map. */
export function searchRoute(progress: Progress[]): { from: string; to: string } | null {
  const s = progress.find((x) => x.step === "search")
  return s?.from && s?.to ? { from: s.from, to: s.to } : null
}
