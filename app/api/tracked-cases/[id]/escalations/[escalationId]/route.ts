import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../../../../lib/server/pinAuth"
import { updateCaseEscalation } from "../../../../../../lib/server/tracked-cases"
import {
  TrackedCaseConflictError,
  TrackedCaseNotFoundError,
} from "../../../../../../lib/tracked-cases"
import { TaskValidationError } from "../../../../../../lib/tasks"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; escalationId: string }> },
) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id, escalationId } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const escalation = await updateCaseEscalation(id, escalationId, {
      state: body.state,
      reason: body.reason,
    })
    return NextResponse.json({ escalation })
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
    console.error("Tracked case escalation update error:", error)
    return NextResponse.json({ error: "Unable to update tracked case escalation" }, { status: 500 })
  }
}
