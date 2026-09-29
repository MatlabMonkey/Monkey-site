import { createClient } from "@supabase/supabase-js"
import {
  isTodoBucket,
  isTodoItemType,
  normalizeTodoContext,
  type TodoBucket,
  type TodoContext,
  type TodoItemType,
  type TodoOutcome,
} from "../todos"
import { normalizeTodoCaptureIdentity, TodoValidationError } from "../todoCaptureIdentity"

export { TodoValidationError } from "../todoCaptureIdentity"

type NullableString = string | null

export type TodoRecord = {
  id: string
  content: string
  completed: boolean
  folder: TodoBucket
  context: TodoContext
  item_type: TodoItemType
  project_id: NullableString
  sort_order: number | null
  scheduled_for: NullableString
  waiting_for: NullableString
  clarified_at: NullableString
  source: string
  source_id: NullableString
  idempotency_key: NullableString
  created_at: string
  updated_at: string
}

export type TodoSort = "newest" | "oldest" | "next_up"
export type TodoScheduledFilter = "all" | "with" | "without"

export type ListTodosOptions = {
  bucket?: TodoBucket
  context?: TodoContext
  includeCompleted?: boolean
  projectId?: string
  scheduled?: TodoScheduledFilter
  sort?: TodoSort
}

export type CreateTodoInput = {
  content: string
  folder?: TodoBucket
  context?: TodoContext
  item_type?: TodoItemType
  project_id?: NullableString
  sort_order?: number | null
  scheduled_for?: NullableString
  waiting_for?: NullableString
  clarified_at?: NullableString
  completed?: boolean
  source?: string
  source_id?: NullableString
  idempotency_key?: NullableString
}

export type UpdateTodoInput = Partial<Omit<CreateTodoInput, "source" | "source_id" | "idempotency_key">>

export type CreateTodoResult = {
  todo: TodoRecord
  duplicate: boolean
}

export type ProcessTodoInput = {
  id: string
  outcome: TodoOutcome
  project_id?: NullableString
  scheduled_for?: NullableString
  waiting_for?: NullableString
}

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

function normalizeContent(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TodoValidationError("Content is required")
  }
  return value.trim()
}

function normalizeOptionalString(value: unknown): NullableString | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") {
    throw new TodoValidationError("Expected a string value")
  }
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeBucket(value: unknown): TodoBucket | undefined {
  if (value === undefined) return undefined
  if (!isTodoBucket(value)) {
    throw new TodoValidationError("Invalid folder value")
  }
  return value
}

function normalizeItemType(value: unknown): TodoItemType | undefined {
  if (value === undefined) return undefined
  if (!isTodoItemType(value)) {
    throw new TodoValidationError("Invalid item_type value")
  }
  return value
}

export function normalizeTodoContextOrDefault(value: unknown, fallback: TodoContext = "personal"): TodoContext {
  const normalized = normalizeTodoContext(value)
  if (normalized) return normalized

  if (value === undefined || value === null) return fallback
  if (typeof value === "string" && !value.trim()) return fallback

  throw new TodoValidationError("Invalid context value")
}

function normalizeIsoTimestamp(value: unknown, fieldName: string): NullableString | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") {
    throw new TodoValidationError(`${fieldName} must be a datetime string or null`)
  }

  const trimmed = value.trim()
  if (!trimmed) return null

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    throw new TodoValidationError(`${fieldName} must be a valid datetime`)
  }

  return date.toISOString()
}

function normalizeBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "boolean") {
    throw new TodoValidationError(`${fieldName} must be a boolean`)
  }
  return value
}

function normalizeUuid(value: unknown, fieldName: string): NullableString | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") {
    throw new TodoValidationError(`${fieldName} must be a UUID string or null`)
  }

  const trimmed = value.trim()
  if (!trimmed) return null

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(trimmed)) {
    throw new TodoValidationError(`${fieldName} must be a valid UUID`)
  }

  return trimmed
}

function normalizeSortOrder(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new TodoValidationError("sort_order must be an integer or null")
  }
  return value
}

type NormalizedCreateTodoInput = Record<string, unknown> & {
  context: TodoContext
  source: string
  source_id: NullableString
  idempotency_key: NullableString
}

function normalizeCreateInput(input: CreateTodoInput): NormalizedCreateTodoInput {
  const content = normalizeContent(input.content)
  const folder = normalizeBucket(input.folder) || "inbox"
  const context = normalizeTodoContextOrDefault(input.context)
  const itemType = normalizeItemType(input.item_type) || "task"
  const projectId = normalizeUuid(input.project_id, "project_id")
  const sortOrder = normalizeSortOrder(input.sort_order)
  const scheduledFor = normalizeIsoTimestamp(input.scheduled_for, "scheduled_for")
  const waitingFor = normalizeOptionalString(input.waiting_for)
  const clarifiedAt = normalizeIsoTimestamp(input.clarified_at, "clarified_at")
  const completed = normalizeBoolean(input.completed, "completed") ?? false
  const captureIdentity = normalizeTodoCaptureIdentity(input)

  return {
    content,
    folder,
    context,
    item_type: itemType,
    project_id: projectId ?? null,
    sort_order: sortOrder ?? null,
    scheduled_for: scheduledFor ?? null,
    waiting_for: waitingFor ?? null,
    clarified_at: clarifiedAt ?? null,
    completed,
    ...captureIdentity,
  }
}

function normalizeUpdateInput(input: UpdateTodoInput): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.content !== undefined) {
    updates.content = normalizeContent(input.content)
  }

  if (input.folder !== undefined) {
    updates.folder = normalizeBucket(input.folder)
  }

  if (input.context !== undefined) {
    updates.context = normalizeTodoContextOrDefault(input.context)
  }

  if (input.item_type !== undefined) {
    updates.item_type = normalizeItemType(input.item_type)
  }

  if (input.project_id !== undefined) {
    updates.project_id = normalizeUuid(input.project_id, "project_id")
  }

  if (input.sort_order !== undefined) {
    updates.sort_order = normalizeSortOrder(input.sort_order)
  }

  if (input.scheduled_for !== undefined) {
    updates.scheduled_for = normalizeIsoTimestamp(input.scheduled_for, "scheduled_for")
  }

  if (input.waiting_for !== undefined) {
    updates.waiting_for = normalizeOptionalString(input.waiting_for)
  }

  if (input.clarified_at !== undefined) {
    updates.clarified_at = normalizeIsoTimestamp(input.clarified_at, "clarified_at")
  }

  if (input.completed !== undefined) {
    updates.completed = normalizeBoolean(input.completed, "completed")
  }

  if (Object.keys(updates).length === 1) {
    throw new TodoValidationError("No valid fields provided to update")
  }

  return updates
}

export async function listTodos(options: ListTodosOptions = {}): Promise<TodoRecord[]> {
  const {
    bucket = "inbox",
    context = "personal",
    includeCompleted = true,
    projectId,
    scheduled = "all",
    sort = bucket === "next_action" ? "next_up" : "newest",
  } = options

  const supabase = getSupabaseAdmin()
  let query = supabase.from("todos").select("*").eq("context", context).eq("folder", bucket)

  if (!includeCompleted) {
    query = query.eq("completed", false)
  }

  if (projectId) {
    query = query.eq("project_id", projectId)
  }

  if (scheduled === "with") {
    query = query.not("scheduled_for", "is", null)
  } else if (scheduled === "without") {
    query = query.is("scheduled_for", null)
  }

  if (sort === "oldest") {
    query = query.order("created_at", { ascending: true })
  } else if (sort === "next_up") {
    query = query
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
  } else {
    query = query.order("created_at", { ascending: false })
  }

  const { data: todos, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (todos || []) as TodoRecord[]
}

async function findTodoByIdentity(input: NormalizedCreateTodoInput): Promise<TodoRecord | null> {
  if (!input.idempotency_key && !input.source_id) return null

  const supabase = getSupabaseAdmin()
  if (input.idempotency_key) {
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .eq("context", input.context)
      .eq("source", input.source)
      .eq("idempotency_key", input.idempotency_key)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (data) return data as TodoRecord
  }

  if (input.source_id) {
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .eq("context", input.context)
      .eq("source", input.source)
      .eq("source_id", input.source_id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (data) return data as TodoRecord
  }

  return null
}

export async function createTodoWithResult(input: CreateTodoInput): Promise<CreateTodoResult> {
  const payload = normalizeCreateInput(input)
  const existingTodo = await findTodoByIdentity(payload)
  if (existingTodo) {
    return { todo: existingTodo, duplicate: true }
  }

  const supabase = getSupabaseAdmin()
  const { data: todo, error } = await supabase.from("todos").insert([payload]).select("*").single()

  if (error) {
    if (error.code === "23505" && (payload.idempotency_key || payload.source_id)) {
      const racedTodo = await findTodoByIdentity(payload)
      if (racedTodo) {
        return { todo: racedTodo, duplicate: true }
      }
    }
    throw new Error(error.message)
  }

  if (!todo) {
    throw new Error("Todo created but not returned")
  }

  return { todo: todo as TodoRecord, duplicate: false }
}

export async function createTodo(input: CreateTodoInput): Promise<TodoRecord> {
  const result = await createTodoWithResult(input)
  return result.todo
}

export async function updateTodoById(id: string, input: UpdateTodoInput): Promise<TodoRecord> {
  const updates = normalizeUpdateInput(input)
  const supabase = getSupabaseAdmin()

  const { data: todo, error } = await supabase.from("todos").update(updates).eq("id", id).select("*").single()

  if (error) {
    throw new Error(error.message)
  }

  return todo as TodoRecord
}

export async function deleteTodoById(id: string) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from("todos").delete().eq("id", id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function processTodo(input: ProcessTodoInput): Promise<{ todo: TodoRecord; createdLinkedTodo?: TodoRecord }> {
  const clarifiedAt = new Date().toISOString()

  if (!input.id || typeof input.id !== "string") {
    throw new TodoValidationError("id is required")
  }

  switch (input.outcome) {
    case "do_now": {
      const todo = await updateTodoById(input.id, {
        completed: true,
        clarified_at: clarifiedAt,
      })
      return { todo }
    }
    case "next_action": {
      const todo = await updateTodoById(input.id, {
        folder: "next_action",
        item_type: "task",
        completed: false,
        clarified_at: clarifiedAt,
        project_id: input.project_id ?? null,
        scheduled_for: null,
        waiting_for: null,
      })
      return { todo }
    }
    case "project": {
      const todo = await updateTodoById(input.id, {
        folder: "project",
        item_type: "project",
        completed: false,
        clarified_at: clarifiedAt,
        project_id: null,
        scheduled_for: null,
        waiting_for: null,
      })
      return { todo }
    }
    case "waiting_for": {
      const todo = await updateTodoById(input.id, {
        folder: "waiting_for",
        item_type: "task",
        completed: false,
        clarified_at: clarifiedAt,
        waiting_for: input.waiting_for,
        scheduled_for: null,
        project_id: null,
      })
      return { todo }
    }
    case "calendar": {
      const todo = await updateTodoById(input.id, {
        folder: "calendar",
        item_type: "task",
        completed: false,
        clarified_at: clarifiedAt,
        scheduled_for: input.scheduled_for,
        waiting_for: null,
        project_id: null,
      })
      return { todo }
    }
    case "someday_maybe": {
      const todo = await updateTodoById(input.id, {
        folder: "someday_maybe",
        item_type: "task",
        completed: false,
        clarified_at: clarifiedAt,
        project_id: null,
        scheduled_for: null,
        waiting_for: null,
      })
      return { todo }
    }
    case "reference": {
      const todo = await updateTodoById(input.id, {
        folder: "reference",
        item_type: "task",
        completed: false,
        clarified_at: clarifiedAt,
        project_id: null,
        scheduled_for: null,
        waiting_for: null,
      })
      return { todo }
    }
    case "trash": {
      const todo = await updateTodoById(input.id, {
        folder: "trash",
        item_type: "task",
        completed: false,
        clarified_at: clarifiedAt,
        project_id: null,
        scheduled_for: null,
        waiting_for: null,
      })
      return { todo }
    }
    default:
      throw new TodoValidationError("Invalid outcome")
  }
}
