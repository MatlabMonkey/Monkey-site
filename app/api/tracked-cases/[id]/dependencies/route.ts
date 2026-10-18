import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../../../lib/server/pinAuth"
import { createCaseDependency } from "../../../../../lib/server/tracked-cases"
import {
  TrackedCaseConflictError,
  TrackedCaseNotFoundError,
} from "../../../../../lib/tracked-cases"
import { TaskValidationError } from "../../../../../lib/tasks"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const dependency = await createCaseDependency(id, {
      blocked_task_id: body.blocked_task_id,
      blocking_task_id: body.blocking_task_id,
      rationale: body.rationale,
    })
    return NextResponse.json({ dependency }, { status: 201 })
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof TrackedCaseNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof TrackedCaseConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error("Tracked case dependency create error:", error)
    return NextResponse.json({ error: "Unable to create tracked case dependency" }, { status: 500 })
  }
}
