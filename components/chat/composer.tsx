"use client"

import { useEffect, useRef, useState, ViewTransition, type FormEvent, type KeyboardEvent } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUp, Mic, Square } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function Composer({
  busy,
  disabled,
  onSend,
  onStop,
  onVoice,
  voiceDisabled,
  focusSignal,
}: {
  busy: boolean
  disabled?: boolean
  onSend: (text: string) => void
  onStop: () => void
  onVoice: () => void
  voiceDisabled?: boolean
  focusSignal?: number
}) {
  const [value, setValue] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)

  // Grow with the text, up to five lines.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [value])

  useEffect(() => {
    if (focusSignal) ref.current?.focus()
  }, [focusSignal])

  function submit(e?: FormEvent) {
    e?.preventDefault()
    if (busy || disabled || !value.trim()) return
    onSend(value)
    setValue("")
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <ViewTransition name="composer" share="morph" default="none">
      <form onSubmit={submit} className="float-card flex items-end gap-1.5 rounded-[1.6rem] p-2 pl-4 transition-shadow focus-within:shadow-[var(--shadow-float),0_0_0_3px_color-mix(in_oklab,var(--pal)_25%,transparent)]">
        <label htmlFor="composer" className="sr-only">
          Message the Flyte AI agent
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? "Sign in to start" : "Where do you want to go?"}
          className="max-h-[140px] min-h-10 flex-1 resize-none bg-transparent py-2 text-base leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          autoComplete="off"
          enterKeyHint="send"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onVoice}
              onPointerEnter={() => void import("@/lib/voice/engines").then((m) => m.preloadElevenLabs())}
              disabled={voiceDisabled}
              aria-label="Talk to the agent"
              className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-pal/10 hover:text-pal-text disabled:pointer-events-none disabled:opacity-40"
            >
              <Mic className="size-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Talk to the agent</TooltipContent>
        </Tooltip>
        <button
          type={busy ? "button" : "submit"}
          onClick={busy ? onStop : undefined}
          aria-label={busy ? "Stop" : "Send"}
          disabled={!busy && !canSend}
          className={cn(
            "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full transition-[background-color,transform] duration-200 active:scale-90",
            busy || canSend ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={busy ? "stop" : "send"}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="grid place-items-center"
            >
              {busy ? <Square className="size-3.5" fill="currentColor" /> : <ArrowUp className="size-[18px]" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </form>
    </ViewTransition>
  )
}
