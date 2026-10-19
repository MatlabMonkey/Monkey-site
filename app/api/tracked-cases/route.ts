import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../lib/server/pinAuth"
import { createTrackedCase, listTrackedCases } from "../../../lib/server/tracked-cases"
import { TaskValidationError } from "../../../lib/tasks"

export async function GET(request: NextRequest) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return NextResponse.json({ cases: await listTrackedCases() })
  } catch (error) {
    console.error("Tracked cases API error:", error)
    return NextResponse.json({ error: "Unable to load tracked cases" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const trackedCase = await createTrackedCase({
      title: body.title,
      outcome: body.outcome,
      deadline_on: body.deadline_on,
      deadline_provenance_type: body.deadline_provenance_type,
      deadline_provenance_ref: body.deadline_provenance_ref,
      deadline_confidence: body.deadline_confidence,
    })
    return NextResponse.json({ case: trackedCase }, { status: 201 })
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Tracked case create error:", error)
    return NextResponse.json({ error: "Unable to create tracked case" }, { status: 500 })
  }
}
