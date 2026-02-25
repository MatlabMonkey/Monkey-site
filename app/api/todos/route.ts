import { type NextRequest, NextResponse } from "next/server"
import { createTodo, listInboxTodos } from "../../../lib/server/todos"

export async function GET() {
  try {
    const todos = await listInboxTodos()
    return NextResponse.json({ todos: todos || [] })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== "string" || content.trim() === "") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const todo = await createTodo(content.trim(), "inbox")

    return NextResponse.json({ todo }, { status: 201 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
