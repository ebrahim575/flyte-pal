import { ViewTransition } from "react"
import type { Metadata } from "next"
import { BookingApp } from "@/components/chat/booking-app"

export const metadata: Metadata = { title: "Book a flight" }

export default function BookPage() {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <BookingApp />
    </ViewTransition>
  )
}
