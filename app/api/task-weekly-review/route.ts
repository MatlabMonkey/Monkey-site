import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../lib/server/pinAuth"
import { getWeeklyReviewSummary } from "../../../lib/server/task-operating-loops"

export async function GET(request: NextRequest) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return NextResponse.json({ summary: await getWeeklyReviewSummary() })
  } catch (error) {
    console.error("Task weekly review API error:", error)
    return NextResponse.json({ error: "Unable to load weekly review" }, { status: 500 })
  }
}
