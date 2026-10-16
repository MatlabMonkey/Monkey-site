export const TASK_STATUSES = ["inbox", "today", "waiting", "later", "done", "archived"] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]
export type TaskView = "today" | "inbox" | "waiting" | "later" | "done"

export type TaskRecord = {
  id: string
  title: string
  notes: string | null
  status: TaskStatus
  due_on: string | null
  waiting_on: string | null
  source: string
  source_id: string | null
  idempotency_key: string | null
  version: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type TaskEventRecord = {
  id: number
  task_id: string
  event_type: "captured" | "updated" | "status_changed" | "completed" | "archived"
  actor: string
  before_state: Partial<TaskRecord> | null
  after_state: Partial<TaskRecord>
  reason: string | null
  created_at: string
}

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TaskValidationError"
  }
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && TASK_STATUSES.includes(value as TaskStatus)
}

export function normalizeTaskTitle(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TaskValidationError("Title is required")
  }

  const title = value.trim().replace(/\s+/g, " ")
  if (title.length > 500) {
    throw new TaskValidationError("Title must be 500 characters or fewer")
  }
  return title
}

export function normalizeOptionalText(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") throw new TaskValidationError(`${field} must be text or null`)
  const normalized = value.trim()
  return normalized || null
}

export function normalizeDateOnly(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TaskValidationError("due_on must use YYYY-MM-DD or null")
  }

  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TaskValidationError("due_on must be a real calendar date")
  }
  return value
}

export function normalizeTaskStatus(value: unknown, fallback?: TaskStatus): TaskStatus | undefined {
  if (value === undefined && fallback) return fallback
  if (value === undefined) return undefined
  if (!isTaskStatus(value)) throw new TaskValidationError("Invalid task status")
  return value
}

export function taskViewStatuses(view: TaskView): TaskStatus[] {
  return view === "done" ? ["done", "archived"] : [view]
}
