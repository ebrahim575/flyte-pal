"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { FlaskConical, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CheckoutHandlers } from "@/components/paypal/paypal-checkout"
import { cn } from "@/lib/utils"

const METHODS = ["PayPal", "Venmo", "Pay Later"] as const

/**
 * Mock mode only. Walks the same order and capture routes as the real
 * buttons, against the mock backend. Deliberately plain: it is not, and
 * does not look like, a PayPal button.
 */
export function SimulatedCheckout({ createOrder, onApprove, onError }: CheckoutHandlers) {
  const [method, setMethod] = useState<(typeof METHODS)[number]>("PayPal")
  const [working, setWorking] = useState(false)

  async function approve() {
    setWorking(true)
    try {
      const { orderId } = await createOrder()
      await new Promise((r) => setTimeout(r, 700))
      await onApprove(orderId)
    } catch (error) {
      onError(error instanceof Error ? error.message : "Simulated payment failed")
      setWorking(false)
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-pal/40 p-4">
      <p className="mb-3 flex items-center gap-2 text-xs font-medium text-pal-text">
        <FlaskConical className="size-3.5" /> Simulated checkout (mock mode)
      </p>
      <div role="radiogroup" aria-label="Payment method" className="relative mb-3 grid grid-cols-3 rounded-xl bg-muted p-1">
        {METHODS.map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={method === m}
            onClick={() => setMethod(m)}
            className={cn("relative z-10 h-9 rounded-lg text-sm transition-colors", method === m ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {method === m && (
              <motion.span layoutId="sim-method" className="absolute inset-0 -z-10 rounded-lg bg-card shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
            )}
            {m}
          </button>
        ))}
      </div>
      <Button onClick={approve} disabled={working} className="h-11 w-full rounded-xl text-[15px]">
        {working ? <LoaderCircle className="animate-spin" /> : null}
        {working ? "Approving" : `Approve ${method} payment`}
      </Button>
      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
        With a Flyte backend and a PayPal client id set, the official PayPal, Venmo and Pay Later buttons appear here instead.
      </p>
    </div>
  )
}
