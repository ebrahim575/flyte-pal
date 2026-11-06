"use client"

import {
  PayPalProvider,
  PayPalOneTimePaymentButton,
  VenmoOneTimePaymentButton,
  PayLaterOneTimePaymentButton,
  useEligibleMethods,
  usePayPal,
  usePayPalMessages,
  INSTANCE_LOADING_STATE,
} from "@paypal/react-paypal-js/sdk-v6"
import { LoaderCircle } from "lucide-react"
import { useTheme } from "next-themes"

export interface CheckoutHandlers {
  /** Asks this app's server for an order; the Flyte API sets the amount. */
  createOrder: () => Promise<{ orderId: string }>
  onApprove: (orderId: string) => Promise<void>
  onCancel: () => void
  onError: (message: string) => void
}

const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
const ENVIRONMENT = process.env.NEXT_PUBLIC_PAYPAL_ENV === "production" ? "production" : "sandbox"

export const paypalConfigured = Boolean(CLIENT_ID)

/** The official PayPal, Venmo and Pay Later buttons, one order flow. */
export function PayPalCheckout({ amount, ...handlers }: CheckoutHandlers & { amount: number }) {
  if (!CLIENT_ID) return null
  return (
    <PayPalProvider
      clientId={CLIENT_ID}
      environment={ENVIRONMENT}
      components={["paypal-payments", "venmo-payments", "paypal-messages"]}
      pageType="checkout"
    >
      <Buttons amount={amount} {...handlers} />
    </PayPalProvider>
  )
}

function Buttons({ amount, createOrder, onApprove, onCancel, onError }: CheckoutHandlers & { amount: number }) {
  const { loadingStatus } = usePayPal()
  const { eligiblePaymentMethods, isLoading } = useEligibleMethods({
    payload: { currencyCode: "USD", paymentFlow: "ONE_TIME_PAYMENT" },
  })

  if (loadingStatus === INSTANCE_LOADING_STATE.REJECTED) {
    return <p className="text-sm text-destructive">PayPal couldn&apos;t load. Refresh the page and try again.</p>
  }
  if (loadingStatus === INSTANCE_LOADING_STATE.PENDING || isLoading) {
    return (
      <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-muted text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" /> Loading PayPal
      </div>
    )
  }

  const common = {
    createOrder,
    onApprove: ({ orderId }: { orderId: string }) => onApprove(orderId),
    onCancel,
    onError: (error: unknown) => onError(error instanceof Error ? error.message : "PayPal reported an error"),
  }
  const venmo = eligiblePaymentMethods?.isEligible("venmo")
  const payLater = eligiblePaymentMethods?.isEligible("paylater")

  return (
    <div className="flex flex-col gap-2.5 [&_paypal-button]:w-full [&_venmo-button]:w-full [&_paypal-pay-later-button]:w-full">
      <PayPalOneTimePaymentButton {...common} />
      {venmo && <VenmoOneTimePaymentButton {...common} />}
      {payLater && <PayLaterOneTimePaymentButton {...common} />}
      <PayLaterMessage amount={amount} />
    </div>
  )
}

function PayLaterMessage({ amount }: { amount: number }) {
  const { error } = usePayPalMessages({})
  const { resolvedTheme } = useTheme()
  if (error || !(amount > 0)) return null
  // Keyed on the theme so the message re-renders in the right text colour.
  return (
    <div key={resolvedTheme}>
      <paypal-message
        auto-bootstrap={true}
        text-color={resolvedTheme === "dark" ? "WHITE" : "BLACK"}
        amount={amount.toFixed(2)}
        currency-code="USD"
        buyer-country="US"
      />
    </div>
  )
}
