import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../../lib/server/pinAuth"
import { reviewOrganizationProposal } from "../../../../lib/server/task-organization"
import {
  TaskOrganizationConflictError,
  TaskOrganizationNotFoundError,
} from "../../../../lib/task-organization"
import { TaskValidationError } from "../../../../lib/tasks"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const proposal = await reviewOrganizationProposal(id, {
      action: body.action,
      reviewer: "user",
      reason: body.reason,
    })
    return NextResponse.json({ proposal })
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof TaskOrganizationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof TaskOrganizationConflictError) {
      return NextResponse.json({ error: error.message, proposal: error.proposal }, { status: 409 })
    }
    console.error("Organization proposal review error:", error)
    return NextResponse.json({ error: "Unable to review organization proposal" }, { status: 500 })
  }
}
