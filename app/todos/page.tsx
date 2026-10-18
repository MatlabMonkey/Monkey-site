"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Archive, ArrowLeft, CalendarDays, CalendarRange, Check, Circle, Clock3, History, Inbox, Loader2, Plus, RotateCcw, Sparkles, Sun, X } from "lucide-react"
import PinGate from "../components/PinGate"
import PrivateSectionNav from "../components/PrivateSectionNav"
import type { TaskOrganizationProposalRecord } from "../../lib/task-organization"
import type { DailyReviewSummary, RestartSummary, WeeklyReviewSummary } from "../../lib/task-operating-loops"
import type { TaskEventRecord, TaskRecord, TaskStatus } from "../../lib/tasks"

type TaskView = "today" | "inbox" | "review" | "waiting" | "later" | "done" | "history"
type OperatingMode = "normal" | "daily" | "weekly" | "restart"

const VIEWS: Array<{ id: TaskView; label: string; icon: typeof Sun }> = [
  { id: "today", label: "Today", icon: Sun },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "review", label: "Review", icon: Sparkles },
  { id: "waiting", label: "Waiting", icon: Clock3 },
  { id: "later", label: "Later", icon: Archive },
  { id: "done", label: "Done", icon: Check },
  { id: "history", label: "History", icon: History },
]

const VIEW_COPY: Record<TaskView, { title: string; description: string; empty: string }> = {
  today: { title: "Today", description: "Only the commitments you chose for today.", empty: "Today is clear. Pull one useful thing from Inbox when ready." },
  inbox: { title: "Inbox", description: "Captured first. Decide what matters after it is safely recorded.", empty: "Nothing needs organizing." },
  review: { title: "Organization review", description: "Approve or reject assistant suggestions with a short reason.", empty: "No organization suggestions need review." },
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

function operatingModeLabel(mode: Exclude<OperatingMode, "normal">) {
  if (mode === "daily") return "daily reset"
  if (mode === "weekly") return "weekly review"
  return "restart"
}

export default function TodosPage() {
  const [view, setView] = useState<TaskView>("today")
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [events, setEvents] = useState<TaskEventRecord[]>([])
  const [proposals, setProposals] = useState<TaskOrganizationProposalRecord[]>([])
  const [restartSummary, setRestartSummary] = useState<RestartSummary | null>(null)
  const [dailyReviewSummary, setDailyReviewSummary] = useState<DailyReviewSummary | null>(null)
  const [weeklyReviewSummary, setWeeklyReviewSummary] = useState<WeeklyReviewSummary | null>(null)
  const [operatingMode, setOperatingMode] = useState<OperatingMode>("normal")
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
      const endpoint = nextView === "history"
        ? "/api/task-events"
        : nextView === "review"
          ? "/api/task-organization-proposals?state=pending"
          : `/api/tasks?view=${nextView}`
      const response = await fetch(endpoint, { cache: "no-store" })
      const data = (await response.json()) as {
        tasks?: TaskRecord[]
        events?: TaskEventRecord[]
        proposals?: TaskOrganizationProposalRecord[]
        error?: string
      }
      if (!response.ok) throw new Error(data.error || "Unable to load")
      if (nextView === "history") setEvents(data.events || [])
      else if (nextView === "review") setProposals(data.proposals || [])
      else setTasks(data.tasks || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRestart = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/task-restart", { cache: "no-store" })
      const data = (await response.json()) as { summary?: RestartSummary; error?: string }
      if (!response.ok || !data.summary) throw new Error(data.error || "Unable to load restart summary")
      setRestartSummary(data.summary)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load restart summary")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDailyReview = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/task-daily-review", { cache: "no-store" })
      const data = (await response.json()) as { summary?: DailyReviewSummary; error?: string }
      if (!response.ok || !data.summary) throw new Error(data.error || "Unable to load daily review")
      setDailyReviewSummary(data.summary)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load daily review")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadWeeklyReview = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/task-weekly-review", { cache: "no-store" })
      const data = (await response.json()) as { summary?: WeeklyReviewSummary; error?: string }
      if (!response.ok || !data.summary) throw new Error(data.error || "Unable to load weekly review")
      setWeeklyReviewSummary(data.summary)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load weekly review")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadView(view)
  }, [loadView, view])

  useEffect(() => {
    if (operatingMode === "restart") void loadRestart()
    if (operatingMode === "daily") void loadDailyReview()
    if (operatingMode === "weekly") void loadWeeklyReview()
  }, [loadDailyReview, loadRestart, loadWeeklyReview, operatingMode])

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
      if (operatingMode === "restart") await loadRestart()
      else if (operatingMode === "daily") await loadDailyReview()
      else if (operatingMode === "weekly") await loadWeeklyReview()
      else setTasks((current) => current.filter((item) => item.id !== task.id))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update task")
    } finally {
      setUpdatingId(null)
    }
  }

  const reviewProposal = async (proposal: TaskOrganizationProposalRecord, action: "apply" | "reject", reason: string) => {
    setUpdatingId(proposal.id)
    setError("")
    setNotice("")
    try {
      const response = await fetch(`/api/task-organization-proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      })
      const data = (await response.json()) as { proposal?: TaskOrganizationProposalRecord; error?: string }
      if (!response.ok) {
        if (data.proposal?.state === "superseded") {
          setProposals((current) => current.filter((item) => item.id !== proposal.id))
        }
        throw new Error(data.error || "Unable to review suggestion")
      }
      setProposals((current) => current.filter((item) => item.id !== proposal.id))
      setNotice(action === "apply" ? "Suggestion applied." : "Suggestion rejected.")
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review suggestion")
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

          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--brand))]">Execution system · v2</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What needs your attention?</h1>
              <p className="mt-3 text-base leading-relaxed text-[rgb(var(--text-muted))]">Capture immediately. Organize only when it helps the next action.</p>
            </div>
            {operatingMode !== "normal" ? (
              <button
                type="button"
                onClick={() => setOperatingMode("normal")}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 text-sm text-[rgb(var(--text-muted))] transition hover:border-[rgb(var(--brand))] hover:text-[rgb(var(--text))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand)_/_0.5)]"
              >
                <X className="h-4 w-4" /> Exit {operatingModeLabel(operatingMode)}
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOperatingMode("daily")}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak))] px-4 text-sm font-medium transition hover:bg-[rgb(var(--surface-2))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand)_/_0.5)]"
                >
                  <CalendarDays className="h-4 w-4" /> Daily reset
                </button>
                <button
                  type="button"
                  onClick={() => setOperatingMode("weekly")}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 text-sm text-[rgb(var(--text-muted))] transition hover:border-[rgb(var(--brand))] hover:text-[rgb(var(--text))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand)_/_0.5)]"
                >
                  <CalendarRange className="h-4 w-4" /> Weekly review
                </button>
                <button
                  type="button"
                  onClick={() => setOperatingMode("restart")}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 text-sm text-[rgb(var(--text-muted))] transition hover:border-[rgb(var(--brand))] hover:text-[rgb(var(--text))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand)_/_0.5)]"
                >
                  <RotateCcw className="h-4 w-4" /> Restart mode
                </button>
              </div>
            )}
          </header>

          {operatingMode === "restart" ? (
            <RestartPanel
              summary={restartSummary}
              loading={loading}
              error={error}
              busyId={updatingId}
              onMove={moveTask}
              onOpenInbox={() => {
                setOperatingMode("normal")
                setView("inbox")
              }}
            />
          ) : operatingMode === "daily" ? (
            <DailyReviewPanel
              summary={dailyReviewSummary}
              loading={loading}
              error={error}
              busyId={updatingId}
              onMove={moveTask}
              onOpenInbox={() => {
                setOperatingMode("normal")
                setView("inbox")
              }}
            />
          ) : operatingMode === "weekly" ? (
            <WeeklyReviewPanel
              summary={weeklyReviewSummary}
              loading={loading}
              error={error}
              busyId={updatingId}
              onMove={moveTask}
            />
          ) : (
            <>
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
              {view !== "history" && !loading && (
                <span className="font-mono text-sm text-[rgb(var(--text-muted))]">
                  {view === "review" ? proposals.length : openCount}
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
                <Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--brand))]" aria-label="Loading" />
              </div>
            ) : view === "history" ? (
              events.length === 0 ? <EmptyState message={copy.empty} /> : <HistoryList events={events} />
            ) : view === "review" ? (
              proposals.length === 0
                ? <EmptyState message={copy.empty} />
                : <ProposalList proposals={proposals} busyId={updatingId} onReview={reviewProposal} />
            ) : tasks.length === 0 ? (
              <EmptyState message={copy.empty} />
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => <TaskRow key={task.id} task={task} busy={updatingId === task.id} onMove={moveTask} />)}
              </div>
            )}
              </section>
            </>
          )}
        </div>
      </main>
    </PinGate>
  )
}

function DailyReviewPanel({
  summary,
  loading,
  error,
  busyId,
  onMove,
  onOpenInbox,
}: {
  summary: DailyReviewSummary | null
  loading: boolean
  error: string
  busyId: string | null
  onMove: (task: TaskRecord, status: TaskStatus) => void
  onOpenInbox: () => void
}) {
  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--brand))]" aria-label="Loading daily review" />
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="rounded-2xl border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
        {error || "Unable to load daily review."}
      </div>
    )
  }

  return (
    <section aria-labelledby="daily-review-heading" className="space-y-6 rounded-2xl border border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak))] p-4 sm:p-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--brand))]">Daily reset</p>
        <h2 id="daily-review-heading" className="mt-2 text-2xl font-semibold">Your day in five minutes</h2>
        <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--text-muted))]">
          Check real deadlines, protect the Today list, then make one Inbox decision. Nothing changes until you choose an action.
        </p>
      </div>

      {!summary.needs_review ? (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5">
          <p className="font-medium">Nothing needs a daily reset.</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">Today, due commitments, and the Inbox are clear.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <RestartStep
            time="Minutes 0–2"
            title="Deadlines outside Today"
            count={summary.due_outside_today.count}
            visibleCount={summary.due_outside_today.tasks.length}
            empty="No due commitment is hiding outside Today."
          >
            {summary.due_outside_today.tasks.map((task) => (
              <TaskRow key={task.id} task={task} busy={busyId === task.id} onMove={onMove} />
            ))}
          </RestartStep>

          <RestartStep
            time="Minutes 2–4"
            title="Today's focus"
            count={summary.today.count}
            visibleCount={summary.today.tasks.length}
            empty="Today is open. Pull in only what you intend to do."
          >
            {summary.today.tasks.map((task) => (
              <TaskRow key={task.id} task={task} busy={busyId === task.id} onMove={onMove} />
            ))}
          </RestartStep>

          <RestartStep
            time="Minute 5"
            title="Inbox"
            count={summary.inbox_count}
            visibleCount={0}
            empty="Inbox is clear."
          >
            {summary.inbox_count > 0 && (
              <button
                type="button"
                onClick={onOpenInbox}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[rgb(var(--brand))] px-4 text-sm font-semibold text-[rgb(var(--bg))] transition hover:bg-[rgb(var(--brand-strong))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))] focus:ring-offset-2 focus:ring-offset-[rgb(var(--surface))]"
              >
                <Inbox className="h-4 w-4" /> Make one quick decision
              </button>
            )}
          </RestartStep>
        </div>
      )}
    </section>
  )
}

function WeeklyReviewPanel({
  summary,
  loading,
  error,
  busyId,
  onMove,
}: {
  summary: WeeklyReviewSummary | null
  loading: boolean
  error: string
  busyId: string | null
  onMove: (task: TaskRecord, status: TaskStatus) => void
}) {
  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--brand))]" aria-label="Loading weekly review" />
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="rounded-2xl border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
        {error || "Unable to load weekly review."}
      </div>
    )
  }

  return (
    <section aria-labelledby="weekly-review-heading" className="space-y-6 rounded-2xl border border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak))] p-4 sm:p-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--brand))]">Weekly review</p>
        <h2 id="weekly-review-heading" className="mt-2 text-2xl font-semibold">A clear week in 15 minutes</h2>
        <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--text-muted))]">
          Process the oldest Inbox captures, check the oldest Waiting commitments, then reconsider active work that has gone quiet. Nothing changes until you choose an action.
        </p>
      </div>

      {!summary.needs_review ? (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5">
          <p className="font-medium">Your weekly review is clear.</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">No Inbox, Waiting, or stale active work needs attention.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <RestartStep
            time="Minutes 0–5"
            title="Inbox"
            count={summary.inbox.count}
            visibleCount={summary.inbox.tasks.length}
            empty="Inbox is clear."
          >
            {summary.inbox.tasks.map((task) => (
              <TaskRow key={task.id} task={task} busy={busyId === task.id} onMove={onMove} />
            ))}
          </RestartStep>

          <RestartStep
            time="Minutes 5–10"
            title="Waiting"
            count={summary.waiting.count}
            visibleCount={summary.waiting.tasks.length}
            empty="Nothing is waiting on someone else."
          >
            {summary.waiting.tasks.map((task) => (
              <TaskRow key={task.id} task={task} busy={busyId === task.id} onMove={onMove} />
            ))}
          </RestartStep>

          <RestartStep
            time="Minutes 10–15"
            title="Stale active work"
            count={summary.stale_work.count}
            visibleCount={summary.stale_work.tasks.length}
            empty={`No Today or Later work has gone quiet for ${summary.stale_after_days} days.`}
          >
            {summary.stale_work.tasks.map((task) => (
              <TaskRow key={task.id} task={task} busy={busyId === task.id} onMove={onMove} />
            ))}
          </RestartStep>
        </div>
      )}
    </section>
  )
}

function RestartPanel({
  summary,
  loading,
  error,
  busyId,
  onMove,
  onOpenInbox,
}: {
  summary: RestartSummary | null
  loading: boolean
  error: string
  busyId: string | null
  onMove: (task: TaskRecord, status: TaskStatus) => void
  onOpenInbox: () => void
}) {
  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--brand))]" aria-label="Loading restart summary" />
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="rounded-2xl border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
        {error || "Unable to load restart summary."}
      </div>
    )
  }

  return (
    <section aria-labelledby="restart-heading" className="space-y-6 rounded-2xl border border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak))] p-4 sm:p-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--brand))]">Recovery</p>
        <h2 id="restart-heading" className="mt-2 text-2xl font-semibold">Back on track in 10 minutes</h2>
        <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--text-muted))]">
          Review only missed commitments, the Inbox, and Waiting work that has gone quiet. Nothing changes until you choose an action.
        </p>
      </div>

      {!summary.needs_cleanup ? (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5">
          <p className="font-medium">Your system is clear.</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">No missed commitments, Inbox items, or stale Waiting work need recovery.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <RestartStep
            time="Minutes 0–3"
            title="Missed commitments"
            count={summary.missed_commitments.count}
            visibleCount={summary.missed_commitments.tasks.length}
            empty="Nothing is past its real deadline."
          >
            {summary.missed_commitments.tasks.map((task) => (
              <TaskRow key={task.id} task={task} busy={busyId === task.id} onMove={onMove} />
            ))}
          </RestartStep>

          <RestartStep
            time="Minutes 3–7"
            title="Inbox"
            count={summary.inbox_count}
            visibleCount={0}
            empty="Inbox is clear."
          >
            {summary.inbox_count > 0 && (
              <button
                type="button"
                onClick={onOpenInbox}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[rgb(var(--brand))] px-4 text-sm font-semibold text-[rgb(var(--bg))] transition hover:bg-[rgb(var(--brand-strong))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))] focus:ring-offset-2 focus:ring-offset-[rgb(var(--surface))]"
              >
                <Inbox className="h-4 w-4" /> Make one quick decision
              </button>
            )}
          </RestartStep>

          <RestartStep
            time="Minutes 7–10"
            title="Stale Waiting"
            count={summary.stale_waiting.count}
            visibleCount={summary.stale_waiting.tasks.length}
            empty={`No Waiting work has gone quiet for ${summary.stale_after_days} days.`}
          >
            {summary.stale_waiting.tasks.map((task) => (
              <TaskRow key={task.id} task={task} busy={busyId === task.id} onMove={onMove} />
            ))}
          </RestartStep>
        </div>
      )}
    </section>
  )
}

function RestartStep({
  time,
  title,
  count,
  visibleCount,
  empty,
  children,
}: {
  time: string
  title: string
  count: number
  visibleCount: number
  empty: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--text-muted))]">{time}</p>
          <h3 className="mt-2 text-xl font-semibold">{title}</h3>
        </div>
        <span className="font-mono text-sm text-[rgb(var(--text-muted))]">{count}</span>
      </div>
      {count === 0 ? (
        <p className="mt-4 text-sm text-[rgb(var(--text-muted))]">{empty}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {children}
          {visibleCount > 0 && count > visibleCount && (
            <p className="text-xs text-[rgb(var(--text-muted))]">Showing the {visibleCount} oldest of {count}. Finish these before loading more.</p>
          )}
        </div>
      )}
    </section>
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

function ProposalList({
  proposals,
  busyId,
  onReview,
}: {
  proposals: TaskOrganizationProposalRecord[]
  busyId: string | null
  onReview: (proposal: TaskOrganizationProposalRecord, action: "apply" | "reject", reason: string) => Promise<void>
}) {
  const [reasons, setReasons] = useState<Record<string, string>>({})

  return (
    <div className="space-y-4">
      {proposals.map((proposal) => {
        const reason = reasons[proposal.id] || ""
        const busy = busyId === proposal.id
        const taskChanged = proposal.task && proposal.task.version !== proposal.task_version

        return (
          <article key={proposal.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-medium leading-relaxed">{proposal.task?.title || "Unavailable task"}</h3>
                  {taskChanged && (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
                      Task changed
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--text-muted))]">{proposal.rationale}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2 py-1 font-mono text-[rgb(var(--text-muted))]">
                  {Math.round(proposal.confidence * 100)}% confidence
                </span>
                <span className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2 py-1 text-[rgb(var(--text-muted))]">
                  Review required
                </span>
              </div>
            </div>

            <dl className="mt-4 grid gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4 sm:grid-cols-2">
              {Object.entries(proposal.changes).map(([field, value]) => (
                <div key={field} className="flex items-baseline justify-between gap-4 text-sm">
                  <dt className="text-[rgb(var(--text-muted))]">{organizationFieldLabel(field)}</dt>
                  <dd className="text-right font-medium">{organizationValueLabel(field, value)}</dd>
                </div>
              ))}
            </dl>

            <label htmlFor={`review-reason-${proposal.id}`} className="mt-4 block text-sm font-medium">Review note</label>
            <textarea
              id={`review-reason-${proposal.id}`}
              value={reason}
              onChange={(event) => setReasons((current) => ({ ...current, [proposal.id]: event.target.value }))}
              placeholder="Why are you applying or rejecting this suggestion?"
              rows={2}
              maxLength={2000}
              className="mt-2 w-full resize-y rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--brand))] focus:ring-2 focus:ring-[rgb(var(--brand)_/_0.2)]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !reason.trim() || Boolean(taskChanged)}
                onClick={() => void onReview(proposal, "apply", reason)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[rgb(var(--brand))] px-4 text-sm font-semibold text-[rgb(var(--bg))] transition hover:bg-[rgb(var(--brand-strong))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))] focus:ring-offset-2 focus:ring-offset-[rgb(var(--bg))] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Apply
              </button>
              <button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={() => void onReview(proposal, "reject", reason)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-4 text-sm text-[rgb(var(--text-muted))] transition hover:border-red-400/60 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-400/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Reject
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function organizationFieldLabel(field: string) {
  const labels: Record<string, string> = {
    title: "Title",
    notes: "Notes",
    status: "Move to",
    due_on: "Due date",
    waiting_on: "Waiting on",
  }
  return labels[field] || field
}

function organizationValueLabel(field: string, value: string | null) {
  if (value === null) return "Clear"
  if (field === "status") return value.charAt(0).toUpperCase() + value.slice(1)
  if (field === "due_on") return formatDay(value) || value
  return value
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
