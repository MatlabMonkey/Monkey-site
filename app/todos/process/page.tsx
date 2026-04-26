"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarClock, CheckCircle2, Clock3, GitBranch, ListTodo, RotateCcw, Trash2 } from "lucide-react"
import PinGate from "../../components/PinGate"
import { normalizeTodoContext, type TodoContext, type TodoOutcome } from "../../../lib/todos"

type Todo = {
  id: string
  content: string
  completed: boolean
  folder: string
  context: TodoContext
  item_type: string
  project_id: string | null
  scheduled_for: string | null
  waiting_for: string | null
  clarified_at: string | null
  created_at: string
  updated_at: string
}

type LastTransition = {
  before: Todo
  after: Todo
  outcome: TodoOutcome
}

type ClarifyAnswers = {
  actionable: boolean | null
  nonActionableOutcome: Extract<TodoOutcome, "trash" | "reference" | "someday_maybe"> | null
  twoMinute: boolean | null
  delegated: boolean | null
  timeSpecific: boolean | null
  multiStep: boolean | null
}

const DEFAULT_ANSWERS: ClarifyAnswers = {
  actionable: null,
  nonActionableOutcome: null,
  twoMinute: null,
  delegated: null,
  timeSpecific: null,
  multiStep: null,
}

const OUTCOME_LABELS: Record<TodoOutcome, string> = {
  do_now: "Do now",
  next_action: "Next action",
  project: "Project",
  waiting_for: "Waiting for",
  calendar: "Calendar",
  someday_maybe: "Someday/Maybe",
  reference: "Reference",
  trash: "Trash",
}

const DECISION_STEPS = ["Actionable?", "<2 min?", "Delegated?", "Time-specific?", "Multi-step?"]

function resolveOutcomeFromAnswers(answers: ClarifyAnswers): TodoOutcome | null {
  if (answers.actionable === null) return null

  if (answers.actionable === false) {
    return answers.nonActionableOutcome
  }

  if (answers.twoMinute === null) return null
  if (answers.twoMinute) return "do_now"

  if (answers.delegated === null) return null
  if (answers.delegated) return "waiting_for"

  if (answers.timeSpecific === null) return null
  if (answers.timeSpecific) return "calendar"

  if (answers.multiStep === null) return null
  return answers.multiStep ? "project" : "next_action"
}

function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "No date"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function readContextFromLocation(): TodoContext {
  if (typeof window === "undefined") return "personal"
  const params = new URLSearchParams(window.location.search)
  return normalizeTodoContext(params.get("context")) || "personal"
}

export default function ProcessTodosPage() {
  const router = useRouter()
  const [activeContext, setActiveContext] = useState<TodoContext>(readContextFromLocation)
  const [queue, setQueue] = useState<Todo[]>([])
  const [initialQueueSize, setInitialQueueSize] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [lastTransition, setLastTransition] = useState<LastTransition | null>(null)
  const [waitingNote, setWaitingNote] = useState("")
  const [calendarTime, setCalendarTime] = useState("")
  const [savingDetails, setSavingDetails] = useState(false)
  const [answers, setAnswers] = useState<ClarifyAnswers>(DEFAULT_ANSWERS)

  const currentTodo = queue[0] || null
  const processedCount = Math.max(0, initialQueueSize - queue.length)
  const dashboardHref = `/todos?context=${activeContext}&bucket=inbox`
  const resolvedOutcome = useMemo(() => resolveOutcomeFromAnswers(answers), [answers])

  const resetAnswers = useCallback(() => {
    setAnswers(DEFAULT_ANSWERS)
  }, [])

  useEffect(() => {
    resetAnswers()
  }, [currentTodo?.id, resetAnswers])

  useEffect(() => {
    const syncContext = () => {
      const nextContext = readContextFromLocation()
      setActiveContext((current) => (current === nextContext ? current : nextContext))
    }

    syncContext()
    window.addEventListener("popstate", syncContext)
    return () => window.removeEventListener("popstate", syncContext)
  }, [])

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const params = new URLSearchParams({
        context: activeContext,
        bucket: "inbox",
        includeCompleted: "false",
        order: "oldest",
      })
      const response = await fetch(`/api/todos?${params.toString()}`, { cache: "no-store" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load inbox queue")
      }

      const todos = Array.isArray(data.todos) ? (data.todos as Todo[]) : []
      setQueue(todos)
      setInitialQueueSize(todos.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue")
    } finally {
      setLoading(false)
    }
  }, [activeContext])

  useEffect(() => {
    void fetchQueue()
  }, [fetchQueue])

  const processCurrentTodo = useCallback(
    async (outcome: TodoOutcome) => {
      if (!currentTodo || busy) return

      setBusy(true)
      setError("")

      try {
        const response = await fetch("/api/todos/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: currentTodo.id, outcome }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Failed to process todo")
        }

        const updatedTodo = data.todo as Todo
        setQueue((prev) => prev.filter((todo) => todo.id !== currentTodo.id))
        setLastTransition({ before: currentTodo, after: updatedTodo, outcome })

        if (outcome === "waiting_for") {
          setWaitingNote(updatedTodo.waiting_for || "")
        } else {
          setWaitingNote("")
        }

        if (outcome === "calendar") {
          setCalendarTime(toLocalDateTimeInput(updatedTodo.scheduled_for))
        } else {
          setCalendarTime("")
        }

        resetAnswers()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process todo")
      } finally {
        setBusy(false)
      }
    },
    [busy, currentTodo, resetAnswers],
  )

  const undoLast = useCallback(async () => {
    if (!lastTransition || busy) return

    setBusy(true)
    setError("")

    try {
      const { before } = lastTransition
      const response = await fetch(`/api/todos/${before.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: before.content,
          completed: before.completed,
          folder: before.folder,
          context: before.context,
          item_type: before.item_type,
          project_id: before.project_id,
          scheduled_for: before.scheduled_for,
          waiting_for: before.waiting_for,
          clarified_at: before.clarified_at,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to undo")
      }

      const restoredTodo = data.todo as Todo
      setQueue((prev) => [restoredTodo, ...prev])
      setLastTransition(null)
      setWaitingNote("")
      setCalendarTime("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to undo")
    } finally {
      setBusy(false)
    }
  }, [busy, lastTransition])

  const saveWaitingNote = useCallback(async () => {
    if (!lastTransition || lastTransition.outcome !== "waiting_for") return

    setSavingDetails(true)
    setError("")

    try {
      const response = await fetch(`/api/todos/${lastTransition.after.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waiting_for: waitingNote || null }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save waiting note")
      }

      setLastTransition((prev) =>
        prev ? { ...prev, after: { ...prev.after, waiting_for: data.todo.waiting_for ?? null } } : prev,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save waiting note")
    } finally {
      setSavingDetails(false)
    }
  }, [lastTransition, waitingNote])

  const saveCalendarTime = useCallback(async () => {
    if (!lastTransition || lastTransition.outcome !== "calendar") return

    setSavingDetails(true)
    setError("")

    try {
      const payload = calendarTime ? new Date(calendarTime).toISOString() : null
      const response = await fetch(`/api/todos/${lastTransition.after.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_for: payload }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save calendar date")
      }

      setLastTransition((prev) =>
        prev ? { ...prev, after: { ...prev.after, scheduled_for: data.todo.scheduled_for ?? null } } : prev,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save calendar date")
    } finally {
      setSavingDetails(false)
    }
  }, [calendarTime, lastTransition])

  const setActionable = useCallback((value: boolean) => {
    setAnswers((prev) => ({
      actionable: value,
      nonActionableOutcome: value ? null : prev.nonActionableOutcome,
      twoMinute: value ? prev.twoMinute : null,
      delegated: value ? prev.delegated : null,
      timeSpecific: value ? prev.timeSpecific : null,
      multiStep: value ? prev.multiStep : null,
    }))
  }, [])

  const setNonActionableOutcome = useCallback((outcome: Extract<TodoOutcome, "trash" | "reference" | "someday_maybe">) => {
    setAnswers((prev) => ({ ...prev, nonActionableOutcome: outcome }))
  }, [])

  const setTwoMinute = useCallback((value: boolean) => {
    setAnswers((prev) => ({
      ...prev,
      twoMinute: value,
      delegated: value ? null : prev.delegated,
      timeSpecific: value ? null : prev.timeSpecific,
      multiStep: value ? null : prev.multiStep,
    }))
  }, [])

  const setDelegated = useCallback((value: boolean) => {
    setAnswers((prev) => ({
      ...prev,
      delegated: value,
      timeSpecific: value ? null : prev.timeSpecific,
      multiStep: value ? null : prev.multiStep,
    }))
  }, [])

  const setTimeSpecific = useCallback((value: boolean) => {
    setAnswers((prev) => ({
      ...prev,
      timeSpecific: value,
      multiStep: value ? null : prev.multiStep,
    }))
  }, [])

  const setMultiStep = useCallback((value: boolean) => {
    setAnswers((prev) => ({ ...prev, multiStep: value }))
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.closest("input, textarea, select") || target.isContentEditable)) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return

      const key = event.key.toLowerCase()
      if (key === "escape") {
        event.preventDefault()
        router.push(dashboardHref)
        return
      }

      if (key === "u") {
        event.preventDefault()
        void undoLast()
        return
      }

      if (key === "enter" && resolvedOutcome) {
        event.preventDefault()
        void processCurrentTodo(resolvedOutcome)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dashboardHref, processCurrentTodo, resolvedOutcome, router, undoLast])

  if (loading) {
    return (
      <PinGate>
        <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-[rgb(var(--border))] border-t-[rgb(var(--brand))] mx-auto" />
            <p className="text-[rgb(var(--text-muted))]">Loading inbox queue...</p>
          </div>
        </div>
      </PinGate>
    )
  }

  return (
    <PinGate>
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          <header className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <Link href={dashboardHref} className="inline-flex items-center gap-2 text-sm text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Todos
                </Link>
                <h1 className="text-3xl md:text-4xl font-bold">GTD Process Mode</h1>
                <p className="text-[rgb(var(--text-muted))]">Process inbox items one-by-one with keyboard-first decisions.</p>
              </div>
              <div className="text-sm rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.65)] px-4 py-3">
                <p className="font-medium">Progress</p>
                <p className="text-[rgb(var(--text-muted))]">Processed: {processedCount}</p>
                <p className="text-[rgb(var(--text-muted))]">Remaining: {queue.length}</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-[rgb(var(--text-muted))]">Hotkeys: Enter apply decision • U undo • Esc exit</p>
          </header>

          {error && (
            <div className="rounded-xl border border-[rgb(127_29_29)] bg-[rgb(127_29_29_/_0.30)] p-3 text-sm text-[rgb(248_113_113)]">
              {error}
            </div>
          )}

          {!currentTodo ? (
            <section className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-10 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 mx-auto text-[rgb(var(--brand))]" />
              <h2 className="text-2xl font-semibold">Inbox cleared</h2>
              <p className="text-[rgb(var(--text-muted))]">Everything in inbox has been clarified.</p>
              <Link
                href={dashboardHref}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgb(var(--brand))] text-[rgb(var(--text))] hover:bg-[rgb(var(--brand-strong))] transition-colors"
              >
                <ListTodo className="w-4 h-4" />
                Return to Dashboard
              </Link>
            </section>
          ) : (
            <>
              <section className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.8)] p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Current Inbox Item</h2>
                  <span className="text-xs text-[rgb(var(--text-muted))]">Created {new Date(currentTodo.created_at).toLocaleString()}</span>
                </div>
                <p className="text-lg leading-relaxed">{currentTodo.content}</p>
              </section>

              <section className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-6">
                <h3 className="text-lg font-semibold mb-2">GTD clarify flow</h3>
                <p className="text-sm text-[rgb(var(--text-muted))] mb-4">Answer the decision tree and apply the resolved outcome.</p>

                <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.5)] p-4 space-y-4">
                  {answers.actionable === null && (
                    <div className="space-y-2">
                      <p className="font-medium">1) Is it actionable?</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setActionable(true)}
                          disabled={busy}
                          className="px-4 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionable(false)}
                          disabled={busy}
                          className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface)_/_0.8)] disabled:opacity-60"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}

                  {answers.actionable === false && answers.nonActionableOutcome === null && (
                    <div className="space-y-2">
                      <p className="font-medium">2) What should happen with this non-actionable item?</p>
                      <div className="grid sm:grid-cols-3 gap-2">
                        <button type="button" onClick={() => setNonActionableOutcome("trash")} disabled={busy} className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface)_/_0.8)] disabled:opacity-60">Trash</button>
                        <button type="button" onClick={() => setNonActionableOutcome("reference")} disabled={busy} className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface)_/_0.8)] disabled:opacity-60">Reference</button>
                        <button type="button" onClick={() => setNonActionableOutcome("someday_maybe")} disabled={busy} className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface)_/_0.8)] disabled:opacity-60">Someday/Maybe</button>
                      </div>
                    </div>
                  )}

                  {answers.actionable === true && answers.twoMinute === null && (
                    <div className="space-y-2">
                      <p className="font-medium">2) Will this take less than 2 minutes?</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setTwoMinute(true)} disabled={busy} className="px-4 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60">Yes, do now</button>
                        <button type="button" onClick={() => setTwoMinute(false)} disabled={busy} className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface)_/_0.8)] disabled:opacity-60">No</button>
                      </div>
                    </div>
                  )}

                  {answers.actionable === true && answers.twoMinute === false && answers.delegated === null && (
                    <div className="space-y-2">
                      <p className="font-medium">3) Is this delegated or blocked by someone else?</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setDelegated(true)} disabled={busy} className="px-4 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60">Yes</button>
                        <button type="button" onClick={() => setDelegated(false)} disabled={busy} className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface)_/_0.8)] disabled:opacity-60">No</button>
                      </div>
                    </div>
                  )}

                  {answers.actionable === true && answers.twoMinute === false && answers.delegated === false && answers.timeSpecific === null && (
                    <div className="space-y-2">
                      <p className="font-medium">4) Must it happen on a specific date/time?</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setTimeSpecific(true)} disabled={busy} className="px-4 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60">Yes</button>
                        <button type="button" onClick={() => setTimeSpecific(false)} disabled={busy} className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface)_/_0.8)] disabled:opacity-60">No</button>
                      </div>
                    </div>
                  )}

                  {answers.actionable === true && answers.twoMinute === false && answers.delegated === false && answers.timeSpecific === false && answers.multiStep === null && (
                    <div className="space-y-2">
                      <p className="font-medium">5) Is it a multi-step outcome?</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setMultiStep(true)} disabled={busy} className="px-4 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60">Yes, project</button>
                        <button type="button" onClick={() => setMultiStep(false)} disabled={busy} className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface)_/_0.8)] disabled:opacity-60">No, next action</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[rgb(var(--text-muted))]">Resolved outcome:</span>
                  <span className="px-2.5 py-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.8)] text-sm font-medium">
                    {resolvedOutcome ? OUTCOME_LABELS[resolvedOutcome] : "Incomplete"}
                  </span>
                  <button
                    type="button"
                    onClick={resetAnswers}
                    disabled={busy}
                    className="ml-auto px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] text-xs hover:bg-[rgb(var(--surface)_/_0.8)] disabled:opacity-60"
                  >
                    Reset flow
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => resolvedOutcome && void processCurrentTodo(resolvedOutcome)}
                    disabled={!resolvedOutcome || busy}
                    className="px-4 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60"
                  >
                    {busy ? "Applying..." : "Apply decision"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void undoLast()}
                    disabled={!lastTransition || busy}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2)_/_0.7)] disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Undo Last (U)
                  </button>
                </div>
              </section>
            </>
          )}

          {lastTransition && (
            <section className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6 space-y-4">
              <h3 className="text-lg font-semibold">Last processed</h3>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[rgb(var(--text-muted))]">
                <span className="px-2 py-1 rounded-lg bg-[rgb(var(--surface-2)_/_0.8)] border border-[rgb(var(--border))]">
                  Outcome: {lastTransition.outcome}
                </span>
                <span>{lastTransition.after.content}</span>
              </div>

              {lastTransition.outcome === "waiting_for" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium inline-flex items-center gap-2">
                    <Clock3 className="w-4 h-4" />
                    Optional waiting note
                  </label>
                  <div className="flex flex-col md:flex-row gap-2">
                    <input
                      type="text"
                      value={waitingNote}
                      onChange={(event) => setWaitingNote(event.target.value)}
                      placeholder="Waiting on who or what?"
                      className="flex-1 px-3 py-2 rounded-xl bg-[rgb(var(--surface-2)_/_0.7)] border border-[rgb(var(--border))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
                    />
                    <button
                      type="button"
                      onClick={() => void saveWaitingNote()}
                      disabled={savingDetails}
                      className="px-4 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60"
                    >
                      Save note
                    </button>
                  </div>
                </div>
              )}

              {lastTransition.outcome === "calendar" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium inline-flex items-center gap-2">
                    <CalendarClock className="w-4 h-4" />
                    Optional schedule
                  </label>
                  <div className="flex flex-col md:flex-row gap-2">
                    <input
                      type="datetime-local"
                      value={calendarTime}
                      onChange={(event) => setCalendarTime(event.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-[rgb(var(--surface-2)_/_0.7)] border border-[rgb(var(--border))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
                    />
                    <button
                      type="button"
                      onClick={() => void saveCalendarTime()}
                      disabled={savingDetails}
                      className="px-4 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60"
                    >
                      Save date
                    </button>
                  </div>
                  <p className="text-xs text-[rgb(var(--text-muted))]">Current: {formatDateTime(lastTransition.after.scheduled_for)}</p>
                </div>
              )}
            </section>
          )}

          <section className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-6">
            <h3 className="text-lg font-semibold mb-3 inline-flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Decision Map
            </h3>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
              {DECISION_STEPS.map((step, index) => (
                <div key={step} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.7)] px-3 py-2">
                  <p className="font-semibold text-sm">{index + 1}</p>
                  <p className="text-xs text-[rgb(var(--text-muted))]">{step}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-[rgb(var(--text-muted))] inline-flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" />
              Press Esc any time to exit process mode.
            </div>
          </section>
        </div>
      </div>
    </PinGate>
  )
}
