import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../../lib/server/pinAuth"
import { generateDueDateOrganizationProposals } from "../../../../lib/server/task-organization"

export async function POST(request: NextRequest) {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return NextResponse.json(await generateDueDateOrganizationProposals())
  } catch (error) {
    console.error("Organization proposal generation error:", error)
    return NextResponse.json({ error: "Unable to generate organization proposals" }, { status: 500 })
  }
}
