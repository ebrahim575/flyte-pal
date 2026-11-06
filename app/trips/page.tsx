import { ViewTransition } from "react"
import type { Metadata } from "next"
import { TripsView } from "@/components/trips/trips-view"

export const metadata: Metadata = { title: "Your trips" }

export default function TripsPage() {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <TripsView />
    </ViewTransition>
  )
}
