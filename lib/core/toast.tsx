'use client'

// CANONICAL: shared toast notifications for FamComply dashboard pages.
// One hook, one viewport. Pages call push('success' | 'error' | 'info', message).

import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      counter.current += 1
      const id = counter.current
      setToasts((prev) => [...prev.slice(-2), { id, tone, message }])
      // Auto-dismiss timing lives in ToastCard so hover/focus can pause it (WCAG 2.2.1).
    },
    []
  )

  return { toasts, push, dismiss }
}

const TONE_DOT: Record<ToastTone, string> = {
  success: 'bg-teal-600',
  error: 'bg-rose-600',
  info: 'bg-slate-500',
}

// WCAG 2.2.1: the dismiss timer pauses while a toast is hovered or holds focus,
// and messages over ~120 characters get extra reading time.
const AUTO_DISMISS_MS = 5200
const LONG_MESSAGE_MS = 9000
const LONG_MESSAGE_CHARS = 120

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const remaining = useRef(toast.message.length > LONG_MESSAGE_CHARS ? LONG_MESSAGE_MS : AUTO_DISMISS_MS)
  const startedAt = useRef(0)
  const timer = useRef<number | null>(null)
  const hovered = useRef(false)
  const focused = useRef(false)

  const pause = useCallback(() => {
    if (timer.current === null) return
    window.clearTimeout(timer.current)
    timer.current = null
    remaining.current = Math.max(remaining.current - (Date.now() - startedAt.current), 1200)
  }, [])

  const resume = useCallback(() => {
    if (timer.current !== null || hovered.current || focused.current) return
    startedAt.current = Date.now()
    timer.current = window.setTimeout(() => onDismiss(toast.id), remaining.current)
  }, [onDismiss, toast.id])

  useEffect(() => {
    resume()
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [resume])

  return (
    <div
      onMouseEnter={() => {
        hovered.current = true
        pause()
      }}
      onMouseLeave={() => {
        hovered.current = false
        resume()
      }}
      onFocus={() => {
        focused.current = true
        pause()
      }}
      onBlur={() => {
        focused.current = false
        resume()
      }}
      className="animate-fade-up pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
    >
      <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${TONE_DOT[toast.tone]}`} />
      <p className="flex-1 text-sm text-slate-800">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="flex-none rounded p-1 text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  )
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 right-4 z-50 flex w-full max-w-sm flex-col gap-2 lg:bottom-6"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
