import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../lib/server/pinAuth"
import { listTaskEvents } from "../../../lib/server/tasks"

export async function GET(request: NextRequest) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const requested = Number(request.nextUrl.searchParams.get("limit") || 80)
    const limit = Number.isFinite(requested) ? requested : 80
    return NextResponse.json({ events: await listTaskEvents(limit) })
  } catch (error) {
    console.error("Task events API error:", error)
    return NextResponse.json({ error: "Unable to load task history" }, { status: 500 })
  }
}
