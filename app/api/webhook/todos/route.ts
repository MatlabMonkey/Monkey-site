import { type NextRequest, NextResponse } from "next/server"
import { isTodoBucket, normalizeTodoContext } from "../../../../lib/todos"
import { createTodoWithResult, TodoValidationError } from "../../../../lib/server/todos"

type TodoWebhookPayload = {
  content?: unknown
  text?: unknown
  todo?: unknown
  task?: unknown
  folder?: unknown
  context?: unknown
  source?: unknown
  source_id?: unknown
  sourceId?: unknown
  source_message_id?: unknown
  idempotency_key?: unknown
  idempotencyKey?: unknown
}

function readAuthToken(request: NextRequest): string {
  const authHeader = request.headers.get("authorization")
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim()
  }
  return request.headers.get("x-api-key")?.trim() || ""
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  const value = values.find((candidate) => typeof candidate === "string" && candidate.trim())
  return typeof value === "string" ? value.trim() : undefined
}

export async function POST(request: NextRequest) {
  try {
    const configuredSecret =
      process.env.TODO_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || process.env.CAPTURE_API_KEY

    if (!configuredSecret) {
      return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 })
    }

    const providedSecret = readAuthToken(request)
    if (!providedSecret || providedSecret !== configuredSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: TodoWebhookPayload = {}
    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      body = (await request.json()) as TodoWebhookPayload
    } else {
      const raw = (await request.text()).trim()
      body = { content: raw }
    }

    const content = firstNonEmptyString(body.content, body.text, body.todo, body.task) || ""

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const folder = typeof body.folder === "string" && body.folder.trim() ? body.folder.trim() : "inbox"
    if (!isTodoBucket(folder)) {
      return NextResponse.json({ error: "Invalid folder value" }, { status: 400 })
    }

    const rawContext = body.context
    const normalizedContext = normalizeTodoContext(rawContext)
    if (rawContext !== undefined && rawContext !== null && !normalizedContext) {
      return NextResponse.json({ error: "Invalid context value" }, { status: 400 })
    }

    const result = await createTodoWithResult({
      content,
      folder,
      context: normalizedContext || "personal",
      source: firstNonEmptyString(body.source) || "webhook",
      source_id: firstNonEmptyString(body.source_id, body.sourceId, body.source_message_id),
      idempotency_key: firstNonEmptyString(
        body.idempotency_key,
        body.idempotencyKey,
        request.headers.get("idempotency-key"),
      ),
    })

    return NextResponse.json(
      { success: true, duplicate: result.duplicate, todo: result.todo },
      { status: result.duplicate ? 200 : 201 },
    )
  } catch (error) {
    if (error instanceof TodoValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Todo webhook API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
