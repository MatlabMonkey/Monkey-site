import { type NextRequest, NextResponse } from "next/server"
import { verifyPinSessionToken, PIN_SESSION_COOKIE } from "./lib/server/pinAuth"

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie",
}

function preventAuthCaching(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(PRIVATE_NO_STORE_HEADERS)) response.headers.set(name, value)
  return response
}

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/")
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next()
  }

  const token = request.cookies.get(PIN_SESSION_COOKIE)?.value
  const authenticated = await verifyPinSessionToken(token)
  if (authenticated) return preventAuthCaching(NextResponse.next())

  if (isApiRequest(pathname)) {
    return preventAuthCaching(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }

  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = "/"
  redirectUrl.searchParams.set("auth", "required")
  redirectUrl.searchParams.set("from", pathname)
  return preventAuthCaching(NextResponse.redirect(redirectUrl))
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/journal/:path*",
    "/todos/:path*",
    "/workspace/:path*",
    "/ops/:path*",
    "/pillars/:path*",
    "/tools/adderall-xr/:path*",
    "/tools/bac/:path*",
    "/tools/medication-visualizer/:path*",
    "/api/journal/:path*",
    "/api/todos/:path*",
    "/api/ideas/:path*",
    "/api/contacts/:path*",
    "/api/ops/:path*",
    "/api/pillars/:path*",
  ],
}
