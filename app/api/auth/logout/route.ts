import { NextResponse } from "next/server"
import { pinSessionCookieOptions } from "../../../../lib/server/pinAuth"

export async function POST() {
  const response = NextResponse.json({ authenticated: false })
  response.cookies.set({
    ...pinSessionCookieOptions(),
    value: "",
    maxAge: 0,
  })
  return response
}
