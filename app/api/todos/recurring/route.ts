import { type NextRequest, NextResponse } from "next/server"
import {
  getNextRecurringRunDate,
  normalizeRecurringRRule,
  RecurringValidationError,
} from "../../../../lib/recurring"
import { getSupabaseAdmin } from "../../../../lib/server/todos"
import { normalizeTodoContext, type TodoContext } from "../../../../lib/todos"

type RecurringTodoRecord = {
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

function normalizeContent(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new RecurringValidationError("Content is required")
  }
  return value.trim()
}

function normalizeFolder(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "string" || !value.trim()) {
    throw new RecurringValidationError("folder must be a non-empty string")
  }
  return value.trim()
}

function normalizeContext(value: unknown, fallback: TodoContext = "personal"): TodoContext {
  const normalized = normalizeTodoContext(value)
  if (normalized) return normalized

  if (value === undefined || value === null) return fallback
  if (typeof value === "string" && !value.trim()) return fallback

  throw new RecurringValidationError("context must be one of: personal, work")
}

function normalizeActive(value: unknown): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "boolean") {
    throw new RecurringValidationError("active must be a boolean")
  }
  return value
}

async function readDeleteId(request: NextRequest): Promise<string> {
  const queryId = request.nextUrl.searchParams.get("id")
  if (queryId && queryId.trim()) {
    return queryId.trim()
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    if (typeof body.id === "string" && body.id.trim()) {
      return body.id.trim()
    }
  } catch {
    // Ignore JSON parsing errors for empty DELETE bodies.
  }

  throw new RecurringValidationError("id is required")
}

export async function GET(request: NextRequest) {
  try {
    const contextParam = request.nextUrl.searchParams.get("context")
    const contextFilter = contextParam === null ? undefined : normalizeContext(contextParam)
    const supabase = getSupabaseAdmin()

    let query = supabase.from("recurring_todos").select("*").order("created_at", { ascending: false })
    if (contextFilter) {
      query = query.eq("context", contextFilter)
    }

    const { data, error } = await query
    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ recurringTodos: (data || []) as RecurringTodoRecord[] })
  } catch (error) {
    if (error instanceof RecurringValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Recurring todos GET error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const content = normalizeContent(body.content)
    const context = normalizeContext(body.context)
    const folder = normalizeFolder(body.folder) || "inbox"
    const rrule = normalizeRecurringRRule(body.rrule)
    const nextRunAt = getNextRecurringRunDate(rrule)

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("recurring_todos")
      .insert([
        {
          content,
          context,
          folder,
          rrule,
          next_run_at: nextRunAt,
          active: true,
        },
      ])
      .select("*")
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ recurringTodo: data as RecurringTodoRecord }, { status: 201 })
  } catch (error) {
    if (error instanceof RecurringValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Recurring todos POST error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const id = typeof body.id === "string" ? body.id.trim() : ""
    if (!id) {
      throw new RecurringValidationError("id is required")
    }

    const supabase = getSupabaseAdmin()
    const { data: existing, error: existingError } = await supabase
      .from("recurring_todos")
      .select("*")
      .eq("id", id)
      .single()

    if (existingError) {
      if (existingError.code === "PGRST116") {
        return NextResponse.json({ error: "Recurring todo not found" }, { status: 404 })
      }
      throw new Error(existingError.message)
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.content !== undefined) {
      updates.content = normalizeContent(body.content)
    }

    if (body.context !== undefined) {
      updates.context = normalizeContext(body.context, existing.context as TodoContext)
    }

    if (body.folder !== undefined) {
      updates.folder = normalizeFolder(body.folder)
    }

    const active = normalizeActive(body.active)
    if (active !== undefined) {
      updates.active = active
    }

    const normalizedRule = body.rrule !== undefined ? normalizeRecurringRRule(body.rrule) : undefined
    if (normalizedRule !== undefined) {
      updates.rrule = normalizedRule
    }

    const shouldRecomputeNextRun =
      normalizedRule !== undefined || (active === true && existing.active === false)
    if (shouldRecomputeNextRun) {
      updates.next_run_at = getNextRecurringRunDate(normalizedRule || existing.rrule)
    }

    if (Object.keys(updates).length === 1) {
      throw new RecurringValidationError("No valid fields provided to update")
    }

    const { data, error } = await supabase.from("recurring_todos").update(updates).eq("id", id).select("*").single()

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ recurringTodo: data as RecurringTodoRecord })
  } catch (error) {
    if (error instanceof RecurringValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Recurring todos PATCH error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = await readDeleteId(request)
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from("recurring_todos").delete().eq("id", id)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof RecurringValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Recurring todos DELETE error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
