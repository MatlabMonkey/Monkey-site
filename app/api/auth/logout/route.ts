import { NextResponse } from "next/server"
import { pinSessionCookieOptions } from "../../../../lib/server/pinAuth"

export async function POST() {
  const response = NextResponse.json(
    { authenticated: false },
    { headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } },
  )
  response.cookies.set({
    ...pinSessionCookieOptions(),
    value: "",
    maxAge: 0,
  })
  return response
}
