import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../../lib/server/pinAuth"
import { TaskValidationError } from "../../../../lib/tasks"
import { updateTask } from "../../../../lib/server/tasks"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    return NextResponse.json({ task: await updateTask(id, body) })
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Task update error:", error)
    return NextResponse.json({ error: "Unable to update task" }, { status: 500 })
  }
}
