"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarClock, CheckCircle2, Clock3, Layers, ListTodo, RotateCcw, Trash2 } from "lucide-react"
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

type OutcomeAction = {
  key: string
  outcome: TodoOutcome
  label: string
  description: string
}

const OUTCOME_ACTIONS: OutcomeAction[] = [
  { key: "D", outcome: "do_now", label: "Do Now", description: "Complete immediately" },
  { key: "N", outcome: "next_action", label: "Next Action", description: "Move to actionable queue" },
  { key: "P", outcome: "project", label: "Project", description: "Convert to multi-step project" },
  { key: "W", outcome: "waiting_for", label: "Waiting For", description: "Blocked by someone/something" },
  { key: "C", outcome: "calendar", label: "Calendar", description: "Put on a specific date/time" },
  { key: "S", outcome: "someday_maybe", label: "Someday/Maybe", description: "Keep for later" },
  { key: "R", outcome: "reference", label: "Reference", description: "Store for information" },
  { key: "T", outcome: "trash", label: "Trash", description: "Drop it" },
]

const HOTKEY_TO_OUTCOME: Record<string, TodoOutcome> = {
  d: "do_now",
  n: "next_action",
  p: "project",
  w: "waiting_for",
  c: "calendar",
  s: "someday_maybe",
  r: "reference",
  t: "trash",
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

  const currentTodo = queue[0] || null
  const processedCount = Math.max(0, initialQueueSize - queue.length)
  const dashboardHref = `/todos?context=${activeContext}&bucket=inbox`

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process todo")
      } finally {
        setBusy(false)
      }
    },
    [busy, currentTodo],
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

      const outcome = HOTKEY_TO_OUTCOME[key]
      if (!outcome) return

      event.preventDefault()
      void processCurrentTodo(outcome)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dashboardHref, processCurrentTodo, router, undoLast])

  const legendText = useMemo(() => OUTCOME_ACTIONS.map((action) => `${action.key} ${action.label}`).join(" • "), [])

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
            <p className="mt-4 text-xs text-[rgb(var(--text-muted))]">Hotkeys: {legendText} • U Undo • Esc Exit</p>
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
                <h3 className="text-lg font-semibold mb-4">Clarify outcome</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {OUTCOME_ACTIONS.map((action) => (
                    <button
                      key={action.outcome}
                      type="button"
                      onClick={() => void processCurrentTodo(action.outcome)}
                      disabled={busy}
                      className="text-left p-4 rounded-2xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2)_/_0.65)] transition-colors disabled:opacity-60"
                    >
                      <p className="font-semibold">{action.key} · {action.label}</p>
                      <p className="text-sm text-[rgb(var(--text-muted))] mt-1">{action.description}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-4">
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
              <Layers className="w-5 h-5" />
              Decision Map
            </h3>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
              {OUTCOME_ACTIONS.map((action) => (
                <div key={action.outcome} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.7)] px-3 py-2">
                  <p className="font-semibold text-sm">{action.key}</p>
                  <p className="text-xs text-[rgb(var(--text-muted))]">{action.label}</p>
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
