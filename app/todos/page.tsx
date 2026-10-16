"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Archive, ArrowLeft, Check, Circle, Clock3, History, Inbox, Loader2, Plus, RotateCcw, Sun } from "lucide-react"
import PinGate from "../components/PinGate"
import PrivateSectionNav from "../components/PrivateSectionNav"
import type { TaskEventRecord, TaskRecord, TaskStatus } from "../../lib/tasks"

type TaskView = "today" | "inbox" | "waiting" | "later" | "done" | "history"

const VIEWS: Array<{ id: TaskView; label: string; icon: typeof Sun }> = [
  { id: "today", label: "Today", icon: Sun },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "waiting", label: "Waiting", icon: Clock3 },
  { id: "later", label: "Later", icon: Archive },
  { id: "done", label: "Done", icon: Check },
  { id: "history", label: "History", icon: History },
]

const VIEW_COPY: Record<TaskView, { title: string; description: string; empty: string }> = {
  today: { title: "Today", description: "Only the commitments you chose for today.", empty: "Today is clear. Pull one useful thing from Inbox when ready." },
  inbox: { title: "Inbox", description: "Captured first. Decide what matters after it is safely recorded.", empty: "Nothing needs organizing." },
  waiting: { title: "Waiting", description: "Commitments paused on another person or event.", empty: "Nothing is waiting on someone else." },
  later: { title: "Later", description: "Worth keeping, but not competing for attention now.", empty: "No deferred work." },
  done: { title: "Done", description: "Completed work, newest first.", empty: "Completed tasks will collect here." },
  history: { title: "History", description: "An immutable record of every captured task and state change.", empty: "Task activity will appear here." },
}

function formatDay(value: string | null) {
  if (!value) return null
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatMoment(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function eventLabel(event: TaskEventRecord) {
  if (event.event_type === "captured") return "Captured"
  if (event.event_type === "completed") return "Completed"
  if (event.event_type === "archived") return "Archived"
  if (event.event_type === "status_changed") return `Moved to ${event.after_state.status}`
  return "Updated"
}

export default function TodosPage() {
  const [view, setView] = useState<TaskView>("today")
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [events, setEvents] = useState<TaskEventRecord[]>([])
  const [capture, setCapture] = useState("")
  const [loading, setLoading] = useState(true)
  const [capturing, setCapturing] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const loadView = useCallback(async (nextView: TaskView) => {
    setLoading(true)
    setError("")
    try {
      const endpoint = nextView === "history" ? "/api/task-events" : `/api/tasks?view=${nextView}`
      const response = await fetch(endpoint, { cache: "no-store" })
      const data = (await response.json()) as { tasks?: TaskRecord[]; events?: TaskEventRecord[]; error?: string }
      if (!response.ok) throw new Error(data.error || "Unable to load")
      if (nextView === "history") setEvents(data.events || [])
      else setTasks(data.tasks || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadView(view)
  }, [loadView, view])

  const captureTask = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!capture.trim() || capturing) return
    setCapturing(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: capture }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Unable to capture task")
      setCapture("")
      setNotice("Saved to Inbox.")
      if (view === "inbox" || view === "history") await loadView(view)
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Unable to capture task")
    } finally {
      setCapturing(false)
    }
  }

  const moveTask = async (task: TaskRecord, status: TaskStatus) => {
    setUpdatingId(task.id)
    setError("")
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: `Moved from ${task.status} to ${status}` }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Unable to update task")
      setTasks((current) => current.filter((item) => item.id !== task.id))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update task")
    } finally {
      setUpdatingId(null)
    }
  }

  const copy = VIEW_COPY[view]
  const openCount = useMemo(() => tasks.filter((task) => task.status !== "done" && task.status !== "archived").length, [tasks])

  return (
    <PinGate>
      <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[rgb(var(--text-muted))] transition-colors hover:text-[rgb(var(--text))]">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <PrivateSectionNav />
          </div>

          <header className="mb-8 max-w-3xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--brand))]">Execution system · v2</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What needs your attention?</h1>
            <p className="mt-3 text-base leading-relaxed text-[rgb(var(--text-muted))]">Capture immediately. Organize only when it helps the next action.</p>
          </header>

          <form onSubmit={captureTask} className="mb-8 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 sm:p-5">
            <label htmlFor="task-capture" className="mb-2 block text-sm font-medium">Quick capture</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="task-capture"
                value={capture}
                onChange={(event) => setCapture(event.target.value)}
                placeholder="What do you need to remember?"
                autoComplete="off"
                className="min-h-12 flex-1 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-4 text-base outline-none transition focus:border-[rgb(var(--brand))] focus:ring-2 focus:ring-[rgb(var(--brand)_/_0.2)]"
              />
              <button
                type="submit"
                disabled={!capture.trim() || capturing}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[rgb(var(--brand))] px-5 font-semibold text-[rgb(var(--bg))] transition hover:bg-[rgb(var(--brand-strong))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))] focus:ring-offset-2 focus:ring-offset-[rgb(var(--bg))] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Capture
              </button>
            </div>
            <div className="mt-2 min-h-5 text-sm">
              {notice && <p className="text-green-400">{notice}</p>}
              {error && <p className="text-red-400">{error}</p>}
            </div>
          </form>

          <nav className="mb-8 flex gap-2 overflow-x-auto pb-2" aria-label="Task views">
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-current={view === id ? "page" : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition ${view === id ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak))] text-[rgb(var(--text))]" : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"}`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </nav>

          <section aria-labelledby="view-heading">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 id="view-heading" className="text-2xl font-semibold">{copy.title}</h2>
                <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">{copy.description}</p>
              </div>
              {view !== "history" && !loading && <span className="font-mono text-sm text-[rgb(var(--text-muted))]">{openCount}</span>}
            </div>

            {loading ? (
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
                <Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--brand))]" aria-label="Loading" />
              </div>
            ) : view === "history" ? (
              events.length === 0 ? <EmptyState message={copy.empty} /> : <HistoryList events={events} />
            ) : tasks.length === 0 ? (
              <EmptyState message={copy.empty} />
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => <TaskRow key={task.id} task={task} busy={updatingId === task.id} onMove={moveTask} />)}
              </div>
            )}
          </section>
        </div>
      </main>
    </PinGate>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-6 py-12 text-center">
      <Circle className="mx-auto mb-3 h-5 w-5 text-[rgb(var(--brand))]" />
      <p className="text-sm text-[rgb(var(--text-muted))]">{message}</p>
    </div>
  )
}

function TaskRow({ task, busy, onMove }: { task: TaskRecord; busy: boolean; onMove: (task: TaskRecord, status: TaskStatus) => void }) {
  const actions = task.status === "done" || task.status === "archived"
    ? [{ status: "today" as const, label: "Reopen", icon: RotateCcw }]
    : [
        ...(task.status !== "today" ? [{ status: "today" as const, label: "Today", icon: Sun }] : []),
        ...(task.status !== "waiting" ? [{ status: "waiting" as const, label: "Waiting", icon: Clock3 }] : []),
        ...(task.status !== "later" ? [{ status: "later" as const, label: "Later", icon: Archive }] : []),
        { status: "done" as const, label: "Done", icon: Check },
      ]

  return (
    <article className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className={`text-base font-medium leading-relaxed ${task.status === "done" ? "text-[rgb(var(--text-muted))] line-through" : ""}`}>{task.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[rgb(var(--text-muted))]">
            {task.due_on && <span>Due {formatDay(task.due_on)}</span>}
            {task.waiting_on && <span>Waiting on {task.waiting_on}</span>}
            <span className="font-mono">v{task.version}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map(({ status, label, icon: Icon }) => (
            <button key={status} type="button" disabled={busy} onClick={() => onMove(task, status)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 text-sm text-[rgb(var(--text-muted))] transition hover:border-[rgb(var(--brand))] hover:text-[rgb(var(--text))] disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {label}
            </button>
          ))}
        </div>
      </div>
    </article>
  )
}

function HistoryList({ events }: { events: TaskEventRecord[] }) {
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">{event.after_state.title || "Untitled task"}</p>
              <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">{eventLabel(event)}{event.reason ? ` · ${event.reason}` : ""}</p>
            </div>
            <time className="shrink-0 font-mono text-xs text-[rgb(var(--text-muted))]" dateTime={event.created_at}>{formatMoment(event.created_at)}</time>
          </div>
        </li>
      ))}
    </ol>
  )
}
