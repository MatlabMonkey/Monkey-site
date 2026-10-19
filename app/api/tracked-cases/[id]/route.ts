import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../../lib/server/pinAuth"
import { getTrackedCase, updateTrackedCase } from "../../../../lib/server/tracked-cases"
import {
  TrackedCaseConflictError,
  TrackedCaseNotFoundError,
} from "../../../../lib/tracked-cases"
import { TaskValidationError } from "../../../../lib/tasks"

function trackedCaseErrorResponse(error: unknown) {
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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    return NextResponse.json(await getTrackedCase(id))
  } catch (error) {
    const response = trackedCaseErrorResponse(error)
    if (response) return response
    console.error("Tracked case detail error:", error)
    return NextResponse.json({ error: "Unable to load tracked case" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const trackedCase = await updateTrackedCase(id, {
      expected_version: body.expected_version,
      reason: body.reason,
      title: body.title,
      outcome: body.outcome,
      status: body.status,
      automation_state: body.automation_state,
      ...(Object.hasOwn(body, "deadline_on") ? { deadline_on: body.deadline_on } : {}),
      ...(Object.hasOwn(body, "deadline_provenance_type")
        ? { deadline_provenance_type: body.deadline_provenance_type }
        : {}),
      ...(Object.hasOwn(body, "deadline_provenance_ref")
        ? { deadline_provenance_ref: body.deadline_provenance_ref }
        : {}),
      ...(Object.hasOwn(body, "deadline_confidence")
        ? { deadline_confidence: body.deadline_confidence }
        : {}),
    })
    return NextResponse.json({ case: trackedCase })
  } catch (error) {
    const response = trackedCaseErrorResponse(error)
    if (response) return response
    console.error("Tracked case update error:", error)
    return NextResponse.json({ error: "Unable to update tracked case" }, { status: 500 })
  }
}
