import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../lib/server/pinAuth"
import {
  createOrganizationProposal,
  listOrganizationProposals,
} from "../../../lib/server/task-organization"
import {
  parseOrganizationReviewState,
  TaskOrganizationConflictError,
  TaskOrganizationNotFoundError,
} from "../../../lib/task-organization"
import { TaskValidationError } from "../../../lib/tasks"

export async function GET(request: NextRequest) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const state = parseOrganizationReviewState(request.nextUrl.searchParams.get("state"))
    return NextResponse.json({ proposals: await listOrganizationProposals(state) })
  } catch (error) {
    console.error("Organization proposals API error:", error)
    return NextResponse.json({ error: "Unable to load organization proposals" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const proposal = await createOrganizationProposal({
      task_id: body.task_id,
      task_version: body.task_version,
      changes: body.changes,
      confidence: body.confidence,
      rationale: body.rationale,
      rule_id: body.rule_id,
    })
    return NextResponse.json({ proposal }, { status: 201 })
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
    console.error("Organization proposal creation error:", error)
    return NextResponse.json({ error: "Unable to create organization proposal" }, { status: 500 })
  }
}
