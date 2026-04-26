"use client"

import { memo, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { closestCenter, DndContext, PointerSensor, type DragEndEvent, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  Check,
  ChevronRight,
  Inbox,
  ListChecks,
  Plus,
  PlayCircle,
  Repeat2,
  Trash2,
  Users,
  Archive,
  BookOpen,
  FolderKanban,
  GripVertical,
} from "lucide-react"
import PinGate from "../components/PinGate"
import PrivateSectionNav from "../components/PrivateSectionNav"
import { describeRecurringRRule } from "../../lib/recurring"
import { isTodoBucket, normalizeTodoContext, type TodoBucket, type TodoContext } from "../../lib/todos"

type Todo = {
  id: string
  content: string
  completed: boolean
  folder: string
  context: TodoContext
  item_type: string
  project_id: string | null
  sort_order: number | null
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

type RecurringTodo = {
  id: string
  content: string
  context: TodoContext
  folder: string
  rrule: string
  next_run_at: string
  active: boolean
  created_at: string
  updated_at: string
}

type RecurringFrequency = "daily" | "weekly" | "monthly"

type TodoRowOptions = {
  showProject?: boolean
  showSchedule?: boolean
  showWaiting?: boolean
  dragHandle?: React.ReactNode
  dragging?: boolean
}

type SortableNextActionItemProps = {
  todo: Todo
  renderTodoRow: (todo: Todo, options?: TodoRowOptions) => React.ReactElement
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

const WEEKDAY_OPTIONS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
] as const

const TODO_BUCKET_KEYS: (keyof BucketState)[] = [
  "inbox",
  "next_action",
  "project",
  "waiting_for",
  "calendar",
  "someday_maybe",
  "reference",
]

const WEEKDAY_RRULE_CODES: Record<(typeof WEEKDAY_OPTIONS)[number]["value"], string> = {
  mon: "MO",
  tue: "TU",
  wed: "WE",
  thu: "TH",
  fri: "FR",
  sat: "SA",
  sun: "SU",
}

const RRULE_DAY_LABELS: Record<string, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
}

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

function formatDateOnly(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  if (!match) return dateValue

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return dateValue

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function describeRecurringRuleLabel(rrule: string) {
  try {
    return describeRecurringRRule(rrule)
  } catch {
    const normalized = rrule.trim().toUpperCase()
    if (normalized === "FREQ=DAILY") {
      return "Every day"
    }

    const weeklyMatch = /^FREQ=WEEKLY;BYDAY=([A-Z,]+)$/.exec(normalized)
    if (weeklyMatch) {
      const labels = weeklyMatch[1]
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => RRULE_DAY_LABELS[token] || token)
        .join(", ")
      return labels ? `Every week on ${labels}` : "Every week"
    }

    const monthlyMatch = /^FREQ=MONTHLY;BYMONTHDAY=(\d{1,2})$/.exec(normalized)
    if (monthlyMatch) {
      return `Day ${Number(monthlyMatch[1])} of every month`
    }

    return rrule
  }
}

async function fetchBucket(path: string): Promise<Todo[]> {
  const response = await fetch(path, { cache: "no-store" })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch todos")
  }
  return Array.isArray(data.todos) ? (data.todos as Todo[]) : []
}

async function fetchRecurring(path: string): Promise<RecurringTodo[]> {
  const response = await fetch(path, { cache: "no-store" })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch recurring todos")
  }
  return Array.isArray(data.recurringTodos) ? (data.recurringTodos as RecurringTodo[]) : []
}

function updateTodoAcrossBuckets(current: BucketState, todoId: string, updater: (todo: Todo) => Todo): BucketState {
  let changed = false
  const next = { ...current }

  for (const bucket of TODO_BUCKET_KEYS) {
    const items = current[bucket]
    const updatedItems = items.map((todo) => {
      if (todo.id !== todoId) return todo
      changed = true
      return updater(todo)
    })
    next[bucket] = updatedItems
  }

  return changed ? next : current
}

function removeTodoAcrossBuckets(current: BucketState, todoId: string): BucketState {
  let changed = false
  const next = { ...current }

  for (const bucket of TODO_BUCKET_KEYS) {
    const items = current[bucket]
    const filtered = items.filter((todo) => todo.id !== todoId)
    if (filtered.length !== items.length) {
      changed = true
    }
    next[bucket] = filtered
  }

  return changed ? next : current
}

const SortableNextActionItem = memo(function SortableNextActionItem({ todo, renderTodoRow }: SortableNextActionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {renderTodoRow(todo, {
        showProject: true,
        showSchedule: true,
        dragging: isDragging,
        dragHandle: (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-0.5 p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2)_/_0.7)] transition-colors cursor-grab active:cursor-grabbing touch-none"
            aria-label={`Reorder ${todo.content}`}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        ),
      })}
    </div>
  )
})

SortableNextActionItem.displayName = "SortableNextActionItem"

export default function TodosPage() {
  const router = useRouter()
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

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
  const [recurringTodos, setRecurringTodos] = useState<RecurringTodo[]>([])
  const [recurringContent, setRecurringContent] = useState("")
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>("daily")
  const [recurringWeeklyDays, setRecurringWeeklyDays] = useState<Array<(typeof WEEKDAY_OPTIONS)[number]["value"]>>(["mon"])
  const [recurringMonthlyDay, setRecurringMonthlyDay] = useState("1")
  const [addingRecurring, setAddingRecurring] = useState(false)
  const [recurringActionId, setRecurringActionId] = useState<string | null>(null)
  const [syncingTodoIds, setSyncingTodoIds] = useState<Set<string>>(new Set())

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

  const loadRecurring = useCallback(async () => {
    const params = new URLSearchParams({ context: activeContext })
    try {
      const recurring = await fetchRecurring(`/api/todos/recurring?${params.toString()}`)
      setRecurringTodos(recurring)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recurring todos")
    }
  }, [activeContext])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      await Promise.all([loadDashboard(), loadRecurring()])
      setLoading(false)
    }
    void run()
  }, [loadDashboard, loadRecurring])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([loadDashboard(), loadRecurring()])
    setRefreshing(false)
  }, [loadDashboard, loadRecurring])

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
    if (syncingTodoIds.has(todo.id)) return

    const optimisticCompleted = !todo.completed
    setError("")
    setSyncingTodoIds((current) => {
      const next = new Set(current)
      next.add(todo.id)
      return next
    })
    setBuckets((current) => updateTodoAcrossBuckets(current, todo.id, (item) => ({ ...item, completed: optimisticCompleted })))

    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: optimisticCompleted }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to update todo")
      }

      if (optimisticCompleted) {
        setBuckets((current) => removeTodoAcrossBuckets(current, todo.id))
      }
    } catch (err) {
      setBuckets((current) => updateTodoAcrossBuckets(current, todo.id, (item) => ({ ...item, completed: todo.completed })))
      setError(err instanceof Error ? err.message : "Failed to update todo")
    } finally {
      setSyncingTodoIds((current) => {
        const next = new Set(current)
        next.delete(todo.id)
        return next
      })
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

  const buildRecurringRRule = () => {
    if (recurringFrequency === "daily") {
      return "FREQ=DAILY"
    }

    if (recurringFrequency === "weekly") {
      const byDay = WEEKDAY_OPTIONS.filter((option) => recurringWeeklyDays.includes(option.value)).map(
        (option) => WEEKDAY_RRULE_CODES[option.value],
      )
      if (byDay.length === 0) {
        throw new Error("Select at least one day for a weekly recurring todo")
      }
      return `FREQ=WEEKLY;BYDAY=${byDay.join(",")}`
    }

    const day = Number.parseInt(recurringMonthlyDay, 10)
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new Error("Monthly day must be between 1 and 31")
    }

    return `FREQ=MONTHLY;BYMONTHDAY=${day}`
  }

  const buildLegacyRecurringRRule = () => {
    if (recurringFrequency === "daily") {
      return "daily"
    }

    if (recurringFrequency === "weekly") {
      const days = WEEKDAY_OPTIONS.filter((option) => recurringWeeklyDays.includes(option.value)).map((option) => option.value)
      if (days.length === 0) {
        throw new Error("Select at least one day for a weekly recurring todo")
      }
      return `weekly:${days.join(",")}`
    }

    const day = Number.parseInt(recurringMonthlyDay, 10)
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new Error("Monthly day must be between 1 and 31")
    }

    return `monthly:${day}`
  }

  const toggleRecurringWeeklyDay = (day: (typeof WEEKDAY_OPTIONS)[number]["value"]) => {
    setRecurringWeeklyDays((current) => {
      if (current.includes(day)) {
        return current.filter((value) => value !== day)
      }
      return [...current, day]
    })
  }

  const addRecurringTodo = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!recurringContent.trim() || addingRecurring) return

    let rrule = ""
    try {
      rrule = buildRecurringRRule()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build recurring rule")
      return
    }

    setAddingRecurring(true)
    setError("")

    try {
      const createWithRule = async (rule: string) => {
        const response = await fetch("/api/todos/recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: recurringContent.trim(),
            context: activeContext,
            folder: "inbox",
            rrule: rule,
          }),
        })
        const data = await response.json()
        return { response, data }
      }

      let { response, data } = await createWithRule(rrule)
      const rruleError = typeof data?.error === "string" ? data.error.toLowerCase() : ""
      if (!response.ok && rruleError.includes("rrule")) {
        const fallbackRule = buildLegacyRecurringRRule()
        ;({ response, data } = await createWithRule(fallbackRule))
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to add recurring todo")
      }

      setRecurringContent("")
      setRecurringFrequency("daily")
      setRecurringWeeklyDays(["mon"])
      setRecurringMonthlyDay("1")
      await loadRecurring()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add recurring todo")
    } finally {
      setAddingRecurring(false)
    }
  }

  const toggleRecurringTodoActive = async (todo: RecurringTodo) => {
    if (recurringActionId) return

    setRecurringActionId(todo.id)
    setError("")

    try {
      const params = new URLSearchParams({ id: todo.id })
      const response = await fetch(`/api/todos/recurring?${params.toString()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: todo.id,
          active: !todo.active,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to update recurring todo")
      }

      await loadRecurring()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update recurring todo")
    } finally {
      setRecurringActionId(null)
    }
  }

  const deleteRecurringTodo = async (id: string) => {
    if (recurringActionId) return

    setRecurringActionId(id)
    setError("")

    try {
      const params = new URLSearchParams({ id })
      const response = await fetch(`/api/todos/recurring?${params.toString()}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete recurring todo")
      }

      await loadRecurring()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete recurring todo")
    } finally {
      setRecurringActionId(null)
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

  const saveNextActionOrder = useCallback(async (orderedTodos: Todo[]) => {
    const response = await fetch("/api/todos/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: orderedTodos.map((todo, index) => ({
          id: todo.id,
          sort_order: index,
        })),
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || "Failed to reorder todos")
    }
  }, [])

  const handleNextActionDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeId = String(active.id)
      const overId = String(over.id)
      const oldIndex = buckets.next_action.findIndex((todo) => todo.id === activeId)
      const newIndex = buckets.next_action.findIndex((todo) => todo.id === overId)

      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return

      const reordered = arrayMove(buckets.next_action, oldIndex, newIndex)
      setBuckets((current) => ({ ...current, next_action: reordered }))
      setError("")

      try {
        await saveNextActionOrder(reordered)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reorder todos")
        await refresh()
      }
    },
    [buckets.next_action, refresh, saveNextActionOrder],
  )

  const renderTodoRow = (todo: Todo, options?: TodoRowOptions) => {
    const syncing = syncingTodoIds.has(todo.id)

    return (
      <div
        key={todo.id}
        className={`p-4 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.6)] flex items-start gap-3 ${
          options?.dragging ? "opacity-90" : ""
        } ${syncing ? "animate-pulse" : ""}`}
      >
        {options?.dragHandle}
        <button
          type="button"
          onClick={() => void markCompleted(todo)}
          disabled={syncing}
          className="mt-0.5 w-6 h-6 rounded-full border-2 border-[rgb(var(--border))] hover:border-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-weak)_/_0.7)] flex items-center justify-center transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          aria-label="Mark complete"
        >
          {syncing ? (
            <Clock3 className="w-3.5 h-3.5 animate-spin text-[rgb(var(--brand))]" />
          ) : todo.completed ? (
            <Check className="w-4 h-4" />
          ) : null}
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
          disabled={syncing}
          className="p-2 rounded-xl text-[rgb(var(--text-muted))] hover:text-[rgb(248_113_113)] hover:bg-[rgb(127_29_29_/_0.25)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Delete todo"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )
  }

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
                <p className="text-[rgb(var(--text-muted))] mt-1">Process inbox first. Organize lists second.</p>
                <PrivateSectionNav className="mt-3" />
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
          </header>

          {error && (
            <div className="rounded-xl border border-[rgb(127_29_29)] bg-[rgb(127_29_29_/_0.30)] p-3 text-sm text-[rgb(248_113_113)]">
              {error}
            </div>
          )}

          <section className="rounded-3xl border border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak)_/_0.22)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">Primary GTD step</p>
                <h2 className="text-2xl font-semibold inline-flex items-center gap-2">
                  <PlayCircle className="w-6 h-6 text-[rgb(var(--brand))]" />
                  Process Inbox
                </h2>
                <p className="text-sm text-[rgb(var(--text-muted))]">
                  {buckets.inbox.length} unprocessed item{buckets.inbox.length === 1 ? "" : "s"}. Clarify each item through the decision tree.
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/todos/process?context=${activeContext}&bucket=inbox`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] transition-colors"
                >
                  Start processing
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

          <section className="grid lg:grid-cols-3 gap-4">
            <form onSubmit={addInboxTodo} className="lg:col-span-2 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="w-5 h-5 text-[rgb(var(--brand))]" />
                <h2 className="text-xl font-semibold">Quick Capture ({activeContext === "work" ? "Work" : "Personal"})</h2>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTodo}
                  onChange={(event) => setNewTodo(event.target.value)}
                  placeholder="Capture to inbox, then process..."
                  className="flex-1 px-4 py-3 rounded-2xl bg-[rgb(var(--surface-2)_/_0.7)] border border-[rgb(var(--border))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
                  disabled={adding}
                />
                <button
                  type="submit"
                  disabled={!newTodo.trim() || adding}
                  className="px-4 py-3 rounded-2xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60 transition-colors"
                >
                  {adding ? "Adding..." : "Capture"}
                </button>
              </div>
            </form>

            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-5">
              <h2 className="text-xl font-semibold mb-3">Engage Snapshot</h2>
              <div className="space-y-2 text-sm">
                <p className="text-[rgb(var(--text-muted))]">Next actions: <span className="text-[rgb(var(--text))] font-medium">{buckets.next_action.length}</span></p>
                <p className="text-[rgb(var(--text-muted))]">Calendar: <span className="text-[rgb(var(--text))] font-medium">{buckets.calendar.length}</span></p>
                <p className="text-[rgb(var(--text-muted))]">Waiting for: <span className="text-[rgb(var(--text))] font-medium">{buckets.waiting_for.length}</span></p>
              </div>
            </div>
          </section>

          <details className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.55)] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[rgb(var(--text-muted))]">Open bucket navigation</summary>
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
          </details>

          <section className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Repeat2 className="w-5 h-5 text-[rgb(var(--brand))]" />
              <h2 className="text-xl font-semibold">Recurring</h2>
              <span className="text-sm text-[rgb(var(--text-muted))]">{recurringTodos.length}</span>
            </div>

            {recurringTodos.length === 0 ? (
              <p className="text-sm text-[rgb(var(--text-muted))] mb-5">No recurring todos yet. Add one below.</p>
            ) : (
              <div className="space-y-3 mb-5">
                {recurringTodos.map((todo) => {
                  const busy = recurringActionId === todo.id
                  return (
                    <article
                      key={todo.id}
                      className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.65)] p-4"
                    >
                      <div className="flex flex-wrap items-start gap-3 justify-between">
                        <div className="min-w-0 flex-1">
                          <p className={todo.active ? "font-medium" : "font-medium text-[rgb(var(--text-muted))]"}>{todo.content}</p>
                          <p className="text-xs text-[rgb(var(--text-muted))] mt-1">{describeRecurringRuleLabel(todo.rrule)}</p>
                          <p className="text-xs text-[rgb(var(--text-muted))] mt-1">Next run: {formatDateOnly(todo.next_run_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void toggleRecurringTodoActive(todo)}
                            disabled={recurringActionId !== null}
                            className={`px-3 py-1.5 rounded-xl border text-xs transition-colors disabled:opacity-60 ${
                              todo.active
                                ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak)_/_0.7)]"
                                : "border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] text-[rgb(var(--text-muted))]"
                            }`}
                          >
                            {busy ? "Saving..." : todo.active ? "Active" : "Paused"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteRecurringTodo(todo.id)}
                            disabled={recurringActionId !== null}
                            className="p-2 rounded-xl text-[rgb(var(--text-muted))] hover:text-[rgb(248_113_113)] hover:bg-[rgb(127_29_29_/_0.25)] transition-colors disabled:opacity-60"
                            aria-label={`Delete recurring todo ${todo.content}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            <form onSubmit={addRecurringTodo} className="space-y-3">
              <div>
                <label className="text-xs text-[rgb(var(--text-muted))]">Recurring Todo</label>
                <input
                  type="text"
                  value={recurringContent}
                  onChange={(event) => setRecurringContent(event.target.value)}
                  placeholder="Add a recurring todo..."
                  className="mt-1 w-full px-4 py-3 rounded-2xl bg-[rgb(var(--surface-2)_/_0.7)] border border-[rgb(var(--border))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
                  disabled={addingRecurring}
                />
              </div>

              <div>
                <label className="text-xs text-[rgb(var(--text-muted))]">Frequency</label>
                <select
                  value={recurringFrequency}
                  onChange={(event) => setRecurringFrequency(event.target.value as RecurringFrequency)}
                  className="mt-1 w-full md:w-auto px-3 py-2 rounded-xl bg-[rgb(var(--surface-2)_/_0.7)] border border-[rgb(var(--border))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
                  disabled={addingRecurring}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {recurringFrequency === "weekly" && (
                <div>
                  <p className="text-xs text-[rgb(var(--text-muted))]">Days</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((option) => {
                      const checked = recurringWeeklyDays.includes(option.value)
                      return (
                        <label
                          key={option.value}
                          className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            checked
                              ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak)_/_0.75)]"
                              : "border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] text-[rgb(var(--text-muted))]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRecurringWeeklyDay(option.value)}
                            className="sr-only"
                            disabled={addingRecurring}
                          />
                          {option.label}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {recurringFrequency === "monthly" && (
                <div className="max-w-[180px]">
                  <label className="text-xs text-[rgb(var(--text-muted))]">Day of month</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={recurringMonthlyDay}
                    onChange={(event) => setRecurringMonthlyDay(event.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-[rgb(var(--surface-2)_/_0.7)] border border-[rgb(var(--border))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
                    disabled={addingRecurring}
                  />
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!recurringContent.trim() || addingRecurring || (recurringFrequency === "weekly" && recurringWeeklyDays.length === 0)}
                  className="px-4 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60 transition-colors"
                >
                  {addingRecurring ? "Adding..." : "Add Recurring"}
                </button>
              </div>
            </form>
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
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleNextActionDragEnd(event)}>
                <SortableContext items={buckets.next_action.map((todo) => todo.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {buckets.next_action.map((todo) => (
                      <SortableNextActionItem key={todo.id} todo={todo} renderTodoRow={renderTodoRow} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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
                  const syncing = syncingTodoIds.has(project.id)
                  return (
                    <article key={project.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.65)] p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => void markCompleted(project)}
                          disabled={syncing}
                          className="mt-0.5 w-6 h-6 rounded-full border-2 border-[rgb(var(--border))] hover:border-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-weak)_/_0.7)] flex items-center justify-center transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {syncing ? (
                            <Clock3 className="w-3.5 h-3.5 animate-spin text-[rgb(var(--brand))]" />
                          ) : project.completed ? (
                            <Check className="w-4 h-4" />
                          ) : null}
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

          <details id="bucket-waiting_for" open={activeBucket === "waiting_for"} className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
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

          <details id="bucket-calendar" open={activeBucket === "calendar"} className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
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
            <details id="bucket-someday_maybe" open={activeBucket === "someday_maybe"} className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
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

            <details id="bucket-reference" open={activeBucket === "reference"} className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
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

          <details id="bucket-inbox" open={activeBucket === "inbox"} className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-6">
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
