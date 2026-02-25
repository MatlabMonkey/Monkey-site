import { type NextRequest, NextResponse } from "next/server"
import { deleteTodoById, updateTodoCompleted } from "../../../../lib/server/todos"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { completed } = body

    if (typeof completed !== "boolean") {
      return NextResponse.json({ error: "Completed must be a boolean" }, { status: 400 })
    }

    const todo = await updateTodoCompleted(id, completed)

    return NextResponse.json({ todo })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    await deleteTodoById(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
