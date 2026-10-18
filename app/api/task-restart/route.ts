import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../lib/server/pinAuth"
import { getRestartSummary } from "../../../lib/server/task-operating-loops"

export async function GET(request: NextRequest) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return NextResponse.json({ summary: await getRestartSummary() })
  } catch (error) {
    console.error("Task restart API error:", error)
    return NextResponse.json({ error: "Unable to load restart summary" }, { status: 500 })
  }
}
