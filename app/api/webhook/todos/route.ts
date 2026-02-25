import { type NextRequest, NextResponse } from "next/server"
import { createTodo } from "../../../../lib/server/todos"

type TodoWebhookPayload = {
  content?: unknown
  text?: unknown
  todo?: unknown
  task?: unknown
  folder?: unknown
}

function readAuthToken(request: NextRequest): string {
  const authHeader = request.headers.get("authorization")
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim()
  }
  return request.headers.get("x-api-key")?.trim() || ""
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

    const rawContent = [body.content, body.text, body.todo, body.task].find((value) => typeof value === "string")
    const content = typeof rawContent === "string" ? rawContent.trim() : ""

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const folder = typeof body.folder === "string" && body.folder.trim() ? body.folder.trim() : "inbox"
    const todo = await createTodo(content, folder)

    return NextResponse.json({ success: true, todo }, { status: 201 })
  } catch (error) {
    console.error("Todo webhook API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
