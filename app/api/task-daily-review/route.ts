import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../lib/server/pinAuth"
import { getDailyReviewSummary } from "../../../lib/server/task-operating-loops"

export async function GET(request: NextRequest) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return NextResponse.json({ summary: await getDailyReviewSummary() })
  } catch (error) {
    console.error("Task daily review API error:", error)
    return NextResponse.json({ error: "Unable to load daily review" }, { status: 500 })
  }
}
