import { type NextRequest, NextResponse } from "next/server"
import { isTodoBucket, isTodoItemType, normalizeTodoContext } from "../../../lib/todos"
import { createTodo, listTodos, TodoValidationError, type TodoScheduledFilter, type TodoSort } from "../../../lib/server/todos"

function parseBooleanQuery(value: string | null, fallback: boolean) {
  if (value === null) return fallback
  if (value === "true") return true
  if (value === "false") return false
  throw new TodoValidationError("includeCompleted must be true or false")
}

function parseScheduledQuery(value: string | null): TodoScheduledFilter {
  if (value === null) return "all"
  if (value === "all" || value === "with" || value === "without") return value
  throw new TodoValidationError("scheduled must be one of: all, with, without")
}

function parseSortQuery(value: string | null): TodoSort | undefined {
  if (value === null) return undefined
  if (value === "newest" || value === "oldest" || value === "next_up") return value
  throw new TodoValidationError("order must be one of: newest, oldest, next_up")
}

function parseContextQuery(value: string | null) {
  if (value === null) return "personal"

  const normalized = normalizeTodoContext(value)
  if (!normalized) {
    throw new TodoValidationError("context must be one of: personal, work")
  }

  return normalized
}

export async function GET(request: NextRequest) {
  try {
    const bucketParam = request.nextUrl.searchParams.get("bucket")
    const contextParam = request.nextUrl.searchParams.get("context")
    const includeCompletedParam = request.nextUrl.searchParams.get("includeCompleted")
    const scheduledParam = request.nextUrl.searchParams.get("scheduled")
    const projectIdParam = request.nextUrl.searchParams.get("projectId")
    const sortParam = request.nextUrl.searchParams.get("order")

    if (bucketParam !== null && !isTodoBucket(bucketParam)) {
      return NextResponse.json({ error: "Invalid bucket value" }, { status: 400 })
    }

    const todos = await listTodos({
      bucket: bucketParam || "inbox",
      context: parseContextQuery(contextParam),
      includeCompleted: parseBooleanQuery(includeCompletedParam, true),
      scheduled: parseScheduledQuery(scheduledParam),
      projectId: projectIdParam || undefined,
      sort: parseSortQuery(sortParam),
    })

    return NextResponse.json({ todos: todos || [] })
  } catch (error) {
    if (error instanceof TodoValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const content = body.content
    const folder = body.folder
    const itemType = body.item_type
    const projectId = body.project_id
    const scheduledFor = body.scheduled_for
    const waitingFor = body.waiting_for
    const context = body.context

    if (folder !== undefined && !isTodoBucket(folder)) {
      return NextResponse.json({ error: "Invalid folder value" }, { status: 400 })
    }

    if (itemType !== undefined && !isTodoItemType(itemType)) {
      return NextResponse.json({ error: "Invalid item_type value" }, { status: 400 })
    }

    const normalizedContext = normalizeTodoContext(context)
    if (context !== undefined && context !== null && !normalizedContext) {
      return NextResponse.json({ error: "Invalid context value" }, { status: 400 })
    }

    const todo = await createTodo({
      content: typeof content === "string" ? content : "",
      folder,
      context: normalizedContext,
      item_type: itemType,
      project_id: typeof projectId === "string" || projectId === null ? projectId : undefined,
      scheduled_for: typeof scheduledFor === "string" || scheduledFor === null ? scheduledFor : undefined,
      waiting_for: typeof waitingFor === "string" || waitingFor === null ? waitingFor : undefined,
    })

    return NextResponse.json({ todo }, { status: 201 })
  } catch (error) {
    if (error instanceof TodoValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
