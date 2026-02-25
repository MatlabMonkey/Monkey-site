import { type NextRequest, NextResponse } from "next/server"
import { isTodoOutcome } from "../../../../lib/todos"
import { processTodo, TodoValidationError } from "../../../../lib/server/todos"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const id = typeof body.id === "string" ? body.id : ""
    const outcome = body.outcome

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    if (!isTodoOutcome(outcome)) {
      return NextResponse.json({ error: "Invalid outcome value" }, { status: 400 })
    }

    const result = await processTodo({
      id,
      outcome,
      project_id: typeof body.project_id === "string" || body.project_id === null ? body.project_id : undefined,
      scheduled_for:
        typeof body.scheduled_for === "string" || body.scheduled_for === null ? body.scheduled_for : undefined,
      waiting_for: typeof body.waiting_for === "string" || body.waiting_for === null ? body.waiting_for : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof TodoValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Process todo API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
