import { timingSafeEqual } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { captureTaskWithReplay, TaskCaptureConflictError } from "../../../../lib/server/tasks"
import { normalizeShortcutCapture, TaskValidationError } from "../../../../lib/tasks"

function getConfiguredCaptureKey(): string {
  return process.env.CAPTURE_API_KEY?.trim() ||
    process.env.TODO_WEBHOOK_SECRET?.trim() ||
    process.env.WEBHOOK_SECRET?.trim() ||
    ""
}

function getRequestToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization")
  if (authorization?.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim()
  return request.headers.get("x-api-key")?.trim() || ""
}

function secretsMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

export async function POST(request: NextRequest) {
  const configuredKey = getConfiguredCaptureKey()
  if (!configuredKey) {
    return NextResponse.json({ error: "Task capture is not configured" }, { status: 503 })
  }
  if (!secretsMatch(getRequestToken(request), configuredKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const capture = normalizeShortcutCapture(await request.json())
    const result = await captureTaskWithReplay(capture)
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 })
  } catch (error) {
    if (error instanceof TaskValidationError || error instanceof SyntaxError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof TaskCaptureConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error("Shortcut task capture error:", error)
    return NextResponse.json({ error: "Unable to capture task" }, { status: 500 })
  }
}
