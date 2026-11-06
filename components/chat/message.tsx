"use client"

import { motion } from "motion/react"
import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import { Check, Mic, TriangleAlert } from "lucide-react"
import type { ChatMessage, FlightOffer } from "@/lib/types"
import { FlyteMark } from "@/components/flyte-mark"
import { OfferCard } from "@/components/chat/offer-card"
import { PaymentCard } from "@/components/chat/payment-card"
import { StageTrail } from "@/components/chat/stage-progress"

const EASE = [0.22, 1, 0.36, 1] as const

/** The agent asks for a yes before it takes payment. */
const ASKS_TO_CONFIRM = /reply\s+\**yes\**|confirm (and|to) (book|pay|accept)|shall i (book|confirm)|do you want me to (book|confirm)/i

export function asksToConfirm(message: ChatMessage) {
  return message.role === "assistant" && !message.error && !message.reply?.payment && ASKS_TO_CONFIRM.test(message.content)
}

export function Message({
  message,
  latest,
  conversationId,
  offer,
  travellerName,
  onSend,
}: {
  message: ChatMessage
  latest: boolean
  conversationId: string
  offer: FlightOffer | null
  travellerName: string | null
  onSend: (text: string) => void
}) {
  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="flex justify-end"
      >
        <p className="max-w-[85%] rounded-[1.4rem] rounded-br-md bg-foreground px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-background">
          {message.via === "voice" && <Mic className="mr-1.5 inline size-3.5 align-[-2px] opacity-70" />}
          {message.content}
        </p>
      </motion.div>
    )
  }

  const reply = message.reply
  const showConfirm = latest && asksToConfirm(message)

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="flex gap-3"
    >
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-hairline bg-card">
        <FlyteMark className="size-5 text-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <StageTrail stages={message.progress} />
        {message.content && (
          <div
            className={
              message.error
                ? "flex items-start gap-2 text-[15px] leading-relaxed text-destructive"
                : "prose-chat text-[15px] leading-relaxed"
            }
          >
            {message.error && <TriangleAlert className="mt-1 size-4 shrink-0" />}
            <ReactMarkdown
              remarkPlugins={[remarkBreaks]}
              components={{
                p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                ul: ({ children }) => <ul className="mb-2.5 list-disc space-y-1 pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5">{children}</ol>,
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-pal-text underline underline-offset-4">
                    {children}
                  </a>
                ),
                h1: ({ children }) => <p className="mb-2 font-semibold">{children}</p>,
                h2: ({ children }) => <p className="mb-2 font-semibold">{children}</p>,
                h3: ({ children }) => <p className="mb-2 font-semibold">{children}</p>,
                code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{children}</code>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {reply?.offer && reply.offer.legs.length > 0 && (
          <OfferCard offer={reply.offer} active={latest && reply.canBook !== false} onBook={() => onSend("Book this flight")} />
        )}

        {reply?.payment && (
          <PaymentCard conversationId={conversationId} payment={reply.payment} offer={offer} demo={reply.demo === true} travellerName={travellerName} />
        )}

        {showConfirm && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.35, ease: EASE }} className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => onSend("Yes, confirm")}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-pal px-4 text-sm font-medium text-white transition-transform hover:bg-pal/90 active:scale-95"
            >
              <Check className="size-4" /> Yes, confirm
            </button>
            <button
              onClick={() => onSend("Not yet, I want to change something")}
              className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm transition-colors hover:bg-muted"
            >
              Change something
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
