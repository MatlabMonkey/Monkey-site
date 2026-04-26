import { type NextRequest, NextResponse } from "next/server"
import { verifyPinSessionToken, PIN_SESSION_COOKIE } from "./lib/server/pinAuth"

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/")
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next()
  }

  const token = request.cookies.get(PIN_SESSION_COOKIE)?.value
  const authenticated = await verifyPinSessionToken(token)
  if (authenticated) return NextResponse.next()

  if (isApiRequest(pathname)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = "/"
  redirectUrl.search = ""
  return NextResponse.redirect(redirectUrl)
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/journal/:path*",
    "/todos/:path*",
    "/workspace/:path*",
    "/ops/:path*",
    "/tools/adderall-xr/:path*",
    "/api/journal/:path*",
    "/api/todos/:path*",
    "/api/ideas/:path*",
    "/api/contacts/:path*",
    "/api/ops/:path*",
  ],
}
