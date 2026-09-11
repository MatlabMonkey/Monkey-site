"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import PinGate from "../../components/PinGate"
import PrivateSectionNav from "../../components/PrivateSectionNav"
import { formatIsoDateForDisplay, getLocalDateString, normalizeIsoDate } from "../../../lib/date"
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, FileText, Home, Loader2, PencilLine, SquarePen } from "lucide-react"

type CalendarEntry = {
  id: string
  date: string
  is_draft: boolean
  completed_at: string | null
  created_at: string | null
  updated_at: string | null
}

type CalendarResponse = {
  from: string
  to: string
  entries: CalendarEntry[]
  counts: {
    total: number
    submitted: number
    drafts: number
  }
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function monthBounds(monthDate: Date) {
  const year = monthDate.getUTCFullYear()
  const month = monthDate.getUTCMonth()
  const first = new Date(Date.UTC(year, month, 1))
  const last = new Date(Date.UTC(year, month + 1, 0))
  return { first, last }
}

function calendarDays(monthDate: Date) {
  const { first } = monthBounds(monthDate)
  const start = new Date(first)
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + index)
    return day
  })
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
}

function JournalCalendarPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = getLocalDateString()
  const [submittedDate] = useState(() => normalizeIsoDate(searchParams.get("submitted")))
  const [monthDate, setMonthDate] = useState(() => new Date(`${(submittedDate ?? today).slice(0, 7)}-01T00:00:00Z`))
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [counts, setCounts] = useState<CalendarResponse["counts"]>({ total: 0, submitted: 0, drafts: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { first, last } = useMemo(() => monthBounds(monthDate), [monthDate])
  const days = useMemo(() => calendarDays(monthDate), [monthDate])
  const entryByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry>()
    entries.forEach((entry) => map.set(entry.date, entry))
    return map
  }, [entries])

  useEffect(() => {
    if (searchParams.has("submitted")) {
      router.replace("/journal/calendar", { scroll: false })
    }
  }, [router, searchParams])

  useEffect(() => {
    let cancelled = false

    async function loadCalendar() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/journal/calendar?from=${toIsoDate(first)}&to=${toIsoDate(last)}`, { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || "Failed to load journal calendar")
        }
        if (cancelled) return
        setEntries(data.entries || [])
        setCounts(data.counts || { total: 0, submitted: 0, drafts: 0 })
      } catch (err) {
        if (cancelled) return
        setEntries([])
        setCounts({ total: 0, submitted: 0, drafts: 0 })
        setError(err instanceof Error ? err.message : "Failed to load journal calendar")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCalendar()
    return () => {
      cancelled = true
    }
  }, [first, last])

  const currentMonth = monthDate.getUTCMonth()
  const missingPastDays = days.filter((day) => {
    const iso = toIsoDate(day)
    return day.getUTCMonth() === currentMonth && iso <= today && !entryByDate.has(iso)
  }).length

  return (
    <PinGate>
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="sticky top-0 z-40 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg)_/_0.86)] backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-6 py-4">
            <PrivateSectionNav className="mb-3" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]">
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--border))] px-3 py-2 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]">
                  <Home className="h-3.5 w-3.5" />
                  Home
                </Link>
                <Link href="/journal" className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--border))] px-3 py-2 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]">
                  <SquarePen className="h-3.5 w-3.5" />
                  Journal Entry
                </Link>
              </div>
              <div className="flex items-center gap-2 text-sm text-[rgb(var(--text-muted))]">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{loading ? "Loading calendar" : `${counts.total} entries this month`}</span>
              </div>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-6xl px-6 py-8">
          {submittedDate && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-700/60 bg-emerald-950/40 p-4 text-sm text-emerald-200" role="status">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>Journal entry for {formatIsoDateForDisplay(submittedDate)} submitted.</span>
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1 text-xs text-[rgb(var(--text-muted))]">
                <CalendarDays className="h-3.5 w-3.5 text-[rgb(var(--brand))]" />
                Journal coverage
              </div>
              <h1 className="text-3xl font-semibold text-[rgb(var(--text))]">Journal calendar</h1>
              <p className="mt-2 max-w-2xl text-sm text-[rgb(var(--text-muted))]">
                Month-by-month coverage for submitted entries, drafts, and empty days.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonthDate((prev) => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() - 1, 1)))}
                className="rounded-xl border border-[rgb(var(--border))] p-2 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setMonthDate(new Date(`${today.slice(0, 7)}-01T00:00:00Z`))}
                className="rounded-xl border border-[rgb(var(--border))] px-4 py-2 text-sm font-medium text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setMonthDate((prev) => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 1)))}
                className="rounded-xl border border-[rgb(var(--border))] p-2 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
                aria-label="Next month"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatBox label="Submitted" value={counts.submitted} tone="submitted" />
            <StatBox label="Drafts" value={counts.drafts} tone="draft" />
            <StatBox label="Empty past days" value={missingPastDays} tone="empty" />
            <StatBox label="Month" value={monthLabel(monthDate)} tone="neutral" />
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-700/60 bg-red-950/40 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-[rgb(var(--text))]">{monthLabel(monthDate)}</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[rgb(var(--text-muted))]">
                <LegendDot className="bg-emerald-500/80" label="Submitted" />
                <LegendDot className="bg-amber-400/80" label="Draft" />
                <LegendDot className="border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]" label="No entry" />
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-[rgb(var(--text-muted))]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const iso = toIsoDate(day)
                const entry = entryByDate.get(iso)
                const isCurrentMonth = day.getUTCMonth() === currentMonth
                const isToday = iso === today
                const status = entry ? (entry.is_draft ? "draft" : "submitted") : "empty"

                return (
                  <Link
                    key={iso}
                    href={`/journal?date=${iso}&from=calendar`}
                    className={`group min-h-20 rounded-xl border p-2 text-left transition-all md:min-h-24 ${dayClassName(status, isCurrentMonth, isToday)}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-sm font-medium">{day.getUTCDate()}</span>
                      {entry?.is_draft ? (
                        <PencilLine className="h-4 w-4 opacity-80" />
                      ) : entry ? (
                        <CheckCircle2 className="h-4 w-4 opacity-80" />
                      ) : null}
                    </div>
                    <div className="mt-3 hidden text-xs md:block">
                      {entry ? (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          {entry.is_draft ? "Draft" : "Submitted"}
                        </span>
                      ) : isCurrentMonth ? (
                        <span className="text-[rgb(var(--text-muted))]">No entry</span>
                      ) : null}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        </main>
      </div>
    </PinGate>
  )
}

function dayClassName(status: "submitted" | "draft" | "empty", isCurrentMonth: boolean, isToday: boolean) {
  const todayClass = isToday ? "ring-2 ring-[rgb(var(--brand))]" : ""
  if (!isCurrentMonth) {
    return `border-transparent bg-transparent text-[rgb(var(--text-muted)_/_0.45)] hover:bg-[rgb(var(--surface-2)_/_0.45)] ${todayClass}`
  }
  if (status === "submitted") {
    return `border-emerald-500/45 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400 hover:bg-emerald-500/20 ${todayClass}`
  }
  if (status === "draft") {
    return `border-amber-400/45 bg-amber-400/15 text-amber-100 hover:border-amber-300 hover:bg-amber-400/20 ${todayClass}`
  }
  return `border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.45)] text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))] ${todayClass}`
}

function StatBox({ label, value, tone }: { label: string; value: number | string; tone: "submitted" | "draft" | "empty" | "neutral" }) {
  const toneClass =
    tone === "submitted"
      ? "text-emerald-200"
      : tone === "draft"
        ? "text-amber-200"
        : tone === "empty"
          ? "text-[rgb(var(--text-muted))]"
          : "text-[rgb(var(--text))]"

  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
      <div className="text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  )
}

export default function JournalCalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[rgb(var(--brand))]" />
        </div>
      }
    >
      <JournalCalendarPageContent />
    </Suspense>
  )
}
