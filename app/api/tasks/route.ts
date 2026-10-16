import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../lib/server/pinAuth"
import { TaskValidationError } from "../../../lib/tasks"
import { createTask, listTasks, parseTaskView } from "../../../lib/server/tasks"

export async function GET(request: NextRequest) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return NextResponse.json({ tasks: await listTasks(parseTaskView(request.nextUrl.searchParams.get("view"))) })
  } catch (error) {
    console.error("Tasks API error:", error)
    return NextResponse.json({ error: "Unable to load tasks" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const task = await createTask({
      title: body.title,
      notes: body.notes,
      due_on: body.due_on,
      source: body.source,
      source_id: body.source_id,
      idempotency_key: body.idempotency_key,
    })
    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Tasks API error:", error)
    return NextResponse.json({ error: "Unable to capture task" }, { status: 500 })
  }
}
