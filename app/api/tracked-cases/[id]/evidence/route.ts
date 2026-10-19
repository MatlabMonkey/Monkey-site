import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../../../lib/server/pinAuth"
import { reconcileCaseEvidence } from "../../../../../lib/server/tracked-cases"
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
    const result = await reconcileCaseEvidence(id, {
      evidence_type: body.evidence_type,
      summary: body.summary,
      source: body.source,
      source_id: body.source_id,
      observed_at: body.observed_at,
      content_sha256: body.content_sha256,
      reconciliation_action: body.reconciliation_action,
      reconciliation_rule: body.reconciliation_rule,
      dependency_id: body.dependency_id,
      escalation_severity: body.escalation_severity,
      escalation_reason: body.escalation_reason,
    })
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 })
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
    console.error("Tracked case evidence reconciliation error:", error)
    return NextResponse.json({ error: "Unable to reconcile tracked case evidence" }, { status: 500 })
  }
}
