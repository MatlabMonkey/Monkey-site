"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  Inbox,
  ListChecks,
  Plus,
  PlayCircle,
  Trash2,
  Users,
  Archive,
  BookOpen,
  FolderKanban,
} from "lucide-react"
import PinGate from "../components/PinGate"
import { isTodoBucket, normalizeTodoContext, type TodoBucket, type TodoContext } from "../../lib/todos"

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

type BucketState = {
  inbox: Todo[]
  next_action: Todo[]
  project: Todo[]
  waiting_for: Todo[]
  calendar: Todo[]
  someday_maybe: Todo[]
  reference: Todo[]
}

const EMPTY_BUCKETS: BucketState = {
  inbox: [],
  next_action: [],
  project: [],
  waiting_for: [],
  calendar: [],
  someday_maybe: [],
  reference: [],
}

const CONTEXT_TABS: Array<{ value: TodoContext; label: string }> = [
  { value: "personal", label: "Personal" },
  { value: "work", label: "Work" },
]

const BUCKET_TABS: Array<{ value: TodoBucket; label: string }> = [
  { value: "inbox", label: "Inbox" },
  { value: "next_action", label: "Next" },
  { value: "project", label: "Projects" },
  { value: "waiting_for", label: "Waiting" },
  { value: "calendar", label: "Calendar" },
  { value: "someday_maybe", label: "Someday" },
  { value: "reference", label: "Reference" },
]

function readContextFromLocation(): TodoContext {
  if (typeof window === "undefined") return "personal"
  const params = new URLSearchParams(window.location.search)
  return normalizeTodoContext(params.get("context")) || "personal"
}

function readBucketFromLocation(): TodoBucket {
  if (typeof window === "undefined") return "inbox"
  const params = new URLSearchParams(window.location.search)
  const bucket = params.get("bucket")
  return isTodoBucket(bucket) ? bucket : "inbox"
}

function formatRelative(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

  if (diffHours < 1) return "Just now"
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`
  if (diffHours < 48) return "Yesterday"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatDateTime(iso: string | null) {
  if (!iso) return "No schedule"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "No schedule"
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

async function fetchBucket(path: string): Promise<Todo[]> {
  const response = await fetch(path, { cache: "no-store" })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch todos")
  }
  return Array.isArray(data.todos) ? (data.todos as Todo[]) : []
}

export default function TodosPage() {
  const router = useRouter()

  const [buckets, setBuckets] = useState<BucketState>(EMPTY_BUCKETS)
  const [newTodo, setNewTodo] = useState("")
  const [activeContext, setActiveContext] = useState<TodoContext>(readContextFromLocation)
  const [activeBucket, setActiveBucket] = useState<TodoBucket>(readBucketFromLocation)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const [projectDrafts, setProjectDrafts] = useState<Record<string, string>>({})
  const [addingProjectActionId, setAddingProjectActionId] = useState<string | null>(null)

  useEffect(() => {
    const syncFromLocation = () => {
      const nextContext = readContextFromLocation()
      const nextBucket = readBucketFromLocation()
      setActiveContext((current) => (current === nextContext ? current : nextContext))
      setActiveBucket((current) => (current === nextBucket ? current : nextBucket))
    }

    syncFromLocation()
    window.addEventListener("popstate", syncFromLocation)
    return () => window.removeEventListener("popstate", syncFromLocation)
  }, [])

  const replaceTodosUrl = useCallback(
    (nextContext: TodoContext, nextBucket: TodoBucket) => {
      const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)
      params.set("context", nextContext)
      params.set("bucket", nextBucket)
      router.replace(`/todos?${params.toString()}`, { scroll: false })
    },
    [router],
  )

  const handleContextChange = useCallback(
    (nextContext: TodoContext) => {
      if (nextContext === activeContext) return
      setActiveContext(nextContext)
      replaceTodosUrl(nextContext, activeBucket)
    },
    [activeBucket, activeContext, replaceTodosUrl],
  )

  const handleBucketChange = useCallback(
    (nextBucket: TodoBucket) => {
      setActiveBucket(nextBucket)
      replaceTodosUrl(activeContext, nextBucket)
      const element = document.getElementById(`bucket-${nextBucket}`)
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    },
    [activeContext, replaceTodosUrl],
  )

  const loadDashboard = useCallback(async () => {
    setError("")

    const buildBucketPath = (bucket: TodoBucket, order: "oldest" | "next_up") => {
      const params = new URLSearchParams({
        context: activeContext,
        bucket,
        includeCompleted: "false",
        order,
      })
      return `/api/todos?${params.toString()}`
    }

    try {
      const [inbox, nextActions, projects, waitingFor, calendar, somedayMaybe, reference] = await Promise.all([
        fetchBucket(buildBucketPath("inbox", "oldest")),
        fetchBucket(buildBucketPath("next_action", "next_up")),
        fetchBucket(buildBucketPath("project", "oldest")),
        fetchBucket(buildBucketPath("waiting_for", "oldest")),
        fetchBucket(buildBucketPath("calendar", "next_up")),
        fetchBucket(buildBucketPath("someday_maybe", "oldest")),
        fetchBucket(buildBucketPath("reference", "oldest")),
      ])

      setBuckets({
        inbox,
        next_action: nextActions,
        project: projects,
        waiting_for: waitingFor,
        calendar,
        someday_maybe: somedayMaybe,
        reference,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load GTD dashboard")
    }
  }, [activeContext])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      await loadDashboard()
      setLoading(false)
    }
    void run()
  }, [loadDashboard])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await loadDashboard()
    setRefreshing(false)
  }, [loadDashboard])

  const addInboxTodo = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newTodo.trim() || adding) return

    setAdding(true)
    setError("")

    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newTodo.trim(), context: activeContext }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to add todo")
      }

      setNewTodo("")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add todo")
    } finally {
      setAdding(false)
    }
  }

  const markCompleted = async (todo: Todo) => {
    setError("")
    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !todo.completed }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to update todo")
      }

      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update todo")
    }
  }

  const deleteTodo = async (id: string) => {
    setError("")
    try {
      const response = await fetch(`/api/todos/${id}`, { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete todo")
      }

      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete todo")
    }
  }

  const addNextActionToProject = async (projectId: string) => {
    const draft = projectDrafts[projectId]?.trim() || ""
    if (!draft || addingProjectActionId) return

    setAddingProjectActionId(projectId)
    setError("")

    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: draft,
          folder: "next_action",
          context: activeContext,
          item_type: "task",
          project_id: projectId,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to add next action")
      }

      setProjectDrafts((prev) => ({ ...prev, [projectId]: "" }))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add next action")
    } finally {
      setAddingProjectActionId(null)
    }
  }

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const project of buckets.project) {
      map.set(project.id, project.content)
    }
    return map
  }, [buckets.project])

  const nextActionsByProject = useMemo(() => {
    const grouped = new Map<string, Todo[]>()
    for (const action of buckets.next_action) {
      if (!action.project_id) continue
      const existing = grouped.get(action.project_id) || []
      existing.push(action)
      grouped.set(action.project_id, existing)
    }
    return grouped
  }, [buckets.next_action])

  const renderTodoRow = (todo: Todo, options?: { showProject?: boolean; showSchedule?: boolean; showWaiting?: boolean }) => (
    <div
      key={todo.id}
      className="p-4 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.6)] flex items-start gap-3"
    >
      <button
        type="button"
        onClick={() => void markCompleted(todo)}
        className="mt-0.5 w-6 h-6 rounded-full border-2 border-[rgb(var(--border))] hover:border-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-weak)_/_0.7)] flex items-center justify-center transition-colors"
        aria-label="Mark complete"
      >
        {todo.completed ? <Check className="w-4 h-4" /> : null}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[rgb(var(--text))]">{todo.content}</p>
        <p className="text-xs text-[rgb(var(--text-muted))] mt-1">{formatRelative(todo.created_at)}</p>
        {options?.showProject && todo.project_id && projectNameById.has(todo.project_id) && (
          <p className="text-xs text-[rgb(var(--text-muted))] mt-1">Project: {projectNameById.get(todo.project_id)}</p>
        )}
        {options?.showSchedule && <p className="text-xs text-[rgb(var(--text-muted))] mt-1">{formatDateTime(todo.scheduled_for)}</p>}
        {options?.showWaiting && todo.waiting_for && (
          <p className="text-xs text-[rgb(var(--text-muted))] mt-1">Waiting on: {todo.waiting_for}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void deleteTodo(todo.id)}
        className="p-2 rounded-xl text-[rgb(var(--text-muted))] hover:text-[rgb(248_113_113)] hover:bg-[rgb(127_29_29_/_0.25)] transition-colors"
        aria-label="Delete todo"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )

  if (loading) {
    return (
      <PinGate>
        <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[rgb(var(--border))] border-t-[rgb(var(--brand))] mx-auto" />
            <p className="text-[rgb(var(--text-muted))]">Loading GTD dashboard...</p>
          </div>
        </div>
      </PinGate>
    )
  }

  return (
    <PinGate>
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          <header className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]">
                  <ArrowLeft className="w-4 h-4" />
                  Back Home
                </Link>
                <h1 className="text-3xl md:text-4xl font-bold mt-2">GTD Organizer</h1>
                <p className="text-[rgb(var(--text-muted))] mt-1">Clarify inbox fast, then run from Next Actions.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1.5 rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak)_/_0.65)]">
                  {activeContext === "work" ? "Work Context" : "Personal Context"}
                </span>
                <span className="px-3 py-1.5 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.7)]">
                  Inbox {buckets.inbox.length}
                </span>
                <span className="px-3 py-1.5 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.7)]">
                  Next {buckets.next_action.length}
                </span>
                <span className="px-3 py-1.5 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.7)]">
                  Projects {buckets.project.length}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {CONTEXT_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => handleContextChange(tab.value)}
                  className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
                    activeContext === tab.value
                      ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak)_/_0.8)] text-[rgb(var(--text))]"
                      : "border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.65)] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {BUCKET_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => handleBucketChange(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    activeBucket === tab.value
                      ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak)_/_0.75)] text-[rgb(var(--text))]"
                      : "border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.55)] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </header>

          {error && (
            <div className="rounded-xl border border-[rgb(127_29_29)] bg-[rgb(127_29_29_/_0.30)] p-3 text-sm text-[rgb(248_113_113)]">
              {error}
            </div>
          )}

          <section className="grid lg:grid-cols-3 gap-4">
            <form onSubmit={addInboxTodo} className="lg:col-span-2 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="w-5 h-5 text-[rgb(var(--brand))]" />
                <h2 className="text-xl font-semibold">Quick Capture to Inbox ({activeContext === "work" ? "Work" : "Personal"})</h2>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTodo}
                  onChange={(event) => setNewTodo(event.target.value)}
                  placeholder="Capture something quickly..."
                  className="flex-1 px-4 py-3 rounded-2xl bg-[rgb(var(--surface-2)_/_0.7)] border border-[rgb(var(--border))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
                  disabled={adding}
                />
                <button
                  type="submit"
                  disabled={!newTodo.trim() || adding}
                  className="px-4 py-3 rounded-2xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60 transition-colors"
                >
                  {adding ? "Adding..." : "Add"}
                </button>
              </div>
            </form>

            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <PlayCircle className="w-5 h-5 text-[rgb(var(--brand))]" />
                  <h2 className="text-xl font-semibold">Process Inbox</h2>
                </div>
                <p className="text-sm text-[rgb(var(--text-muted))]">{buckets.inbox.length} unprocessed item{buckets.inbox.length === 1 ? "" : "s"}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/todos/process?context=${activeContext}&bucket=inbox`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] transition-colors"
                >
                  Open
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2)_/_0.7)] transition-colors"
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
          </section>

          <section id="bucket-next_action" className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <ListChecks className="w-5 h-5 text-[rgb(var(--brand))]" />
              <h2 className="text-xl font-semibold">Next Up</h2>
              <span className="text-sm text-[rgb(var(--text-muted))]">{buckets.next_action.length}</span>
            </div>
            {buckets.next_action.length === 0 ? (
              <p className="text-sm text-[rgb(var(--text-muted))]">No next actions yet. Process inbox items into this list.</p>
            ) : (
              <div className="space-y-3">
                {buckets.next_action.map((todo) => renderTodoRow(todo, { showProject: true, showSchedule: true }))}
              </div>
            )}
          </section>

          <section id="bucket-project" className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <FolderKanban className="w-5 h-5 text-[rgb(var(--brand))]" />
              <h2 className="text-xl font-semibold">Projects</h2>
              <span className="text-sm text-[rgb(var(--text-muted))]">{buckets.project.length}</span>
            </div>
            {buckets.project.length === 0 ? (
              <p className="text-sm text-[rgb(var(--text-muted))]">No active projects yet.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {buckets.project.map((project) => {
                  const linkedActions = nextActionsByProject.get(project.id) || []
                  return (
                    <article key={project.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.65)] p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => void markCompleted(project)}
                          className="mt-0.5 w-6 h-6 rounded-full border-2 border-[rgb(var(--border))] hover:border-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-weak)_/_0.7)] flex items-center justify-center transition-colors"
                        >
                          {project.completed ? <Check className="w-4 h-4" /> : null}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{project.content}</p>
                          <p className="text-xs text-[rgb(var(--text-muted))] mt-1">{linkedActions.length} linked next action{linkedActions.length === 1 ? "" : "s"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteTodo(project.id)}
                          className="p-2 rounded-xl text-[rgb(var(--text-muted))] hover:text-[rgb(248_113_113)] hover:bg-[rgb(127_29_29_/_0.25)] transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {linkedActions.length > 0 && (
                        <div className="space-y-2">
                          {linkedActions.map((todo) => renderTodoRow(todo, { showSchedule: true }))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={projectDrafts[project.id] || ""}
                          onChange={(event) =>
                            setProjectDrafts((prev) => ({
                              ...prev,
                              [project.id]: event.target.value,
                            }))
                          }
                          placeholder="Add next action for this project"
                          className="flex-1 px-3 py-2 rounded-xl bg-[rgb(var(--surface)_/_0.7)] border border-[rgb(var(--border))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
                        />
                        <button
                          type="button"
                          disabled={addingProjectActionId === project.id || !(projectDrafts[project.id] || "").trim()}
                          onClick={() => void addNextActionToProject(project.id)}
                          className="px-3 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60"
                        >
                          Add
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <details id="bucket-waiting_for" open className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
            <summary className="cursor-pointer font-semibold inline-flex items-center gap-2">
              <Users className="w-5 h-5 text-[rgb(var(--brand))]" />
              Waiting For ({buckets.waiting_for.length})
            </summary>
            <div className="space-y-3 mt-4">
              {buckets.waiting_for.length === 0 ? (
                <p className="text-sm text-[rgb(var(--text-muted))]">No waiting-for items.</p>
              ) : (
                buckets.waiting_for.map((todo) => renderTodoRow(todo, { showWaiting: true }))
              )}
            </div>
          </details>

          <details id="bucket-calendar" open className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
            <summary className="cursor-pointer font-semibold inline-flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-[rgb(var(--brand))]" />
              Calendar ({buckets.calendar.length})
            </summary>
            <div className="space-y-3 mt-4">
              {buckets.calendar.length === 0 ? (
                <p className="text-sm text-[rgb(var(--text-muted))]">No scheduled actions.</p>
              ) : (
                buckets.calendar.map((todo) => renderTodoRow(todo, { showSchedule: true }))
              )}
            </div>
          </details>

          <section className="grid lg:grid-cols-2 gap-4">
            <details id="bucket-someday_maybe" open className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
              <summary className="cursor-pointer font-semibold inline-flex items-center gap-2">
                <Archive className="w-5 h-5 text-[rgb(var(--brand))]" />
                Someday/Maybe ({buckets.someday_maybe.length})
              </summary>
              <div className="space-y-3 mt-4">
                {buckets.someday_maybe.length === 0 ? (
                  <p className="text-sm text-[rgb(var(--text-muted))]">No someday/maybe items.</p>
                ) : (
                  buckets.someday_maybe.map((todo) => renderTodoRow(todo))
                )}
              </div>
            </details>

            <details id="bucket-reference" open className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
              <summary className="cursor-pointer font-semibold inline-flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[rgb(var(--brand))]" />
                Reference ({buckets.reference.length})
              </summary>
              <div className="space-y-3 mt-4">
                {buckets.reference.length === 0 ? (
                  <p className="text-sm text-[rgb(var(--text-muted))]">No reference items.</p>
                ) : (
                  buckets.reference.map((todo) => renderTodoRow(todo))
                )}
              </div>
            </details>
          </section>

          <details id="bucket-inbox" className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
            <summary className="cursor-pointer font-semibold inline-flex items-center gap-2">
              <Inbox className="w-5 h-5 text-[rgb(var(--brand))]" />
              Inbox Backlog ({buckets.inbox.length})
            </summary>
            <div className="space-y-3 mt-4">
              {buckets.inbox.length === 0 ? (
                <p className="text-sm text-[rgb(var(--text-muted))]">Inbox empty.</p>
              ) : (
                buckets.inbox.map((todo) => renderTodoRow(todo))
              )}
            </div>
          </details>
        </div>
      </div>
    </PinGate>
  )
}
