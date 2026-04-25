import { type NextRequest, NextResponse } from "next/server"
import { isRequestAuthenticated } from "../../../../lib/server/pinAuth"

export async function GET(request: NextRequest) {
  const authenticated = await isRequestAuthenticated(request)
  return NextResponse.json({ authenticated })
}
