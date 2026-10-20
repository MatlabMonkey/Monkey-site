import { type NextRequest, NextResponse } from "next/server"
import { ConnectorEventConflictError, ConnectorEventNotFoundError } from "../../../../lib/connector-events"
import { ingestEmailConnectorEvent } from "../../../../lib/server/connector-events"
import { isRequestAuthenticated } from "../../../../lib/server/pinAuth"
import { TaskValidationError } from "../../../../lib/tasks"

export async function POST(request: NextRequest) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const result = await ingestEmailConnectorEvent({
      case_id: body.case_id,
      provider: body.provider,
      event_id: body.event_id,
      message_id: body.message_id,
      thread_id: body.thread_id,
      observed_at: body.observed_at,
      content_sha256: body.content_sha256,
      signal: body.signal,
      rule: body.rule,
      summary: body.summary,
      dependency_id: body.dependency_id,
    })
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 })
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof ConnectorEventNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof ConnectorEventConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error("Email connector ingestion error:", error)
    return NextResponse.json({ error: "Unable to ingest email connector event" }, { status: 500 })
  }
}
