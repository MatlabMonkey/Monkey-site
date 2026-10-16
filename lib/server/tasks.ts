import { createClient } from "@supabase/supabase-js"
import {
  normalizeDateOnly,
  normalizeOptionalText,
  normalizeTaskStatus,
  normalizeTaskTitle,
  TaskValidationError,
  type TaskEventRecord,
  type TaskRecord,
  type TaskView,
  taskViewStatuses,
} from "../tasks"

export type CreateTaskInput = {
  title: unknown
  notes?: unknown
  due_on?: unknown
  source?: unknown
  source_id?: unknown
  idempotency_key?: unknown
}

export type UpdateTaskInput = {
  title?: unknown
  notes?: unknown
  status?: unknown
  due_on?: unknown
  waiting_on?: unknown
  reason?: unknown
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false } })
}

function normalizeSource(value: unknown): string {
  if (value === undefined) return "web"
  if (typeof value !== "string" || !/^[a-z][a-z0-9_-]{0,49}$/.test(value)) {
    throw new TaskValidationError("source must be a short machine-readable name")
  }
  return value
}

export async function listTasks(view: TaskView): Promise<TaskRecord[]> {
  const statuses = taskViewStatuses(view)
  let query = getSupabaseAdmin().from("tasks").select("*").in("status", statuses)

  query = view === "done"
    ? query.order("completed_at", { ascending: false, nullsFirst: false })
    : query.order("due_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true })

  const { data, error } = await query.limit(200)
  if (error) throw new Error(error.message)
  return (data || []) as TaskRecord[]
}

export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  const payload = {
    title: normalizeTaskTitle(input.title),
    notes: normalizeOptionalText(input.notes, "notes") ?? null,
    due_on: normalizeDateOnly(input.due_on) ?? null,
    source: normalizeSource(input.source),
    source_id: normalizeOptionalText(input.source_id, "source_id") ?? null,
    idempotency_key: normalizeOptionalText(input.idempotency_key, "idempotency_key") ?? null,
  }

  const { data, error } = await getSupabaseAdmin().from("tasks").insert(payload).select("*").single()
  if (error) throw new Error(error.message)
  return data as TaskRecord
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskRecord> {
  const payload: Record<string, unknown> = {}
  if (input.title !== undefined) payload.title = normalizeTaskTitle(input.title)
  if (input.notes !== undefined) payload.notes = normalizeOptionalText(input.notes, "notes")
  if (input.due_on !== undefined) payload.due_on = normalizeDateOnly(input.due_on)
  if (input.waiting_on !== undefined) payload.waiting_on = normalizeOptionalText(input.waiting_on, "waiting_on")
  if (input.status !== undefined) payload.status = normalizeTaskStatus(input.status)

  if (Object.keys(payload).length === 0) throw new TaskValidationError("No task changes provided")

  const reason = normalizeOptionalText(input.reason, "reason")
  payload.change_reason = reason ?? null

  const { data, error } = await getSupabaseAdmin().from("tasks").update(payload).eq("id", id).select("*").single()
  if (error) throw new Error(error.message)
  return data as TaskRecord
}

export async function listTaskEvents(limit = 80): Promise<TaskEventRecord[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200))
  const { data, error } = await getSupabaseAdmin()
    .from("task_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(safeLimit)
  if (error) throw new Error(error.message)
  return (data || []) as TaskEventRecord[]
}

export function parseTaskView(value: string | null): TaskView {
  if (value === "today" || value === "inbox" || value === "waiting" || value === "later" || value === "done") {
    return value
  }
  return "today"
}
