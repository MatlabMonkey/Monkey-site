import { type NextRequest, NextResponse } from "next/server"
import { isTodoBucket, isTodoItemType, normalizeTodoContext } from "../../../../lib/todos"
import { deleteTodoById, TodoValidationError, updateTodoById } from "../../../../lib/server/todos"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>

    if (body.folder !== undefined && !isTodoBucket(body.folder)) {
      return NextResponse.json({ error: "Invalid folder value" }, { status: 400 })
    }

    if (body.item_type !== undefined && !isTodoItemType(body.item_type)) {
      return NextResponse.json({ error: "Invalid item_type value" }, { status: 400 })
    }

    const normalizedContext = normalizeTodoContext(body.context)
    if (body.context !== undefined && !normalizedContext) {
      return NextResponse.json({ error: "Invalid context value" }, { status: 400 })
    }

    if (
      body.sort_order !== undefined &&
      body.sort_order !== null &&
      (typeof body.sort_order !== "number" || !Number.isInteger(body.sort_order))
    ) {
      return NextResponse.json({ error: "Invalid sort_order value" }, { status: 400 })
    }

    const todo = await updateTodoById(id, {
      content: typeof body.content === "string" ? body.content : undefined,
      completed: typeof body.completed === "boolean" ? body.completed : undefined,
      folder: body.folder,
      context: normalizedContext,
      item_type: body.item_type,
      project_id: typeof body.project_id === "string" || body.project_id === null ? body.project_id : undefined,
      sort_order: typeof body.sort_order === "number" || body.sort_order === null ? body.sort_order : undefined,
      scheduled_for: typeof body.scheduled_for === "string" || body.scheduled_for === null ? body.scheduled_for : undefined,
      waiting_for: typeof body.waiting_for === "string" || body.waiting_for === null ? body.waiting_for : undefined,
      clarified_at: typeof body.clarified_at === "string" || body.clarified_at === null ? body.clarified_at : undefined,
    })

    return NextResponse.json({ todo })
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
