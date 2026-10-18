import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../../../lib/server/pinAuth"
import {
  removeTrackedCaseTask,
  setTrackedCaseTask,
} from "../../../../../lib/server/tracked-cases"
import {
  TrackedCaseConflictError,
  TrackedCaseNotFoundError,
} from "../../../../../lib/tracked-cases"
import { TaskValidationError } from "../../../../../lib/tasks"

function errorResponse(error: unknown) {
  if (error instanceof TaskValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (error instanceof TrackedCaseNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
  if (error instanceof TrackedCaseConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 })
  }
  return null
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const task = await setTrackedCaseTask(id, {
      task_id: body.task_id,
      role: body.role,
      reason: body.reason,
    })
    return NextResponse.json({ task })
  } catch (error) {
    const response = errorResponse(error)
    if (response) return response
    console.error("Tracked case task attach error:", error)
    return NextResponse.json({ error: "Unable to attach tracked case task" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const task = await removeTrackedCaseTask(id, {
      task_id: body.task_id,
      reason: body.reason,
    })
    return NextResponse.json({ task })
  } catch (error) {
    const response = errorResponse(error)
    if (response) return response
    console.error("Tracked case task detach error:", error)
    return NextResponse.json({ error: "Unable to detach tracked case task" }, { status: 500 })
  }
}
