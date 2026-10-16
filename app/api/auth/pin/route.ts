import { type NextRequest, NextResponse } from "next/server"
import { createPinSessionToken, pinSessionCookieOptions, resolveExpectedPin } from "../../../../lib/server/pinAuth"
import { clearPinFailures, evaluatePinLockout, recordPinFailure } from "../../../../lib/server/pinRateLimit"

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
}

function authJson(body: Record<string, unknown>, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  for (const [name, value] of Object.entries(PRIVATE_NO_STORE_HEADERS)) headers.set(name, value)

  return NextResponse.json(body, {
    ...init,
    headers,
  })
}

function lockoutResponse(retryAfterSeconds: number) {
  return authJson(
    {
      authenticated: false,
      error: "Too many failed attempts. Try again later.",
      retryAfterSeconds,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  )
}

export async function POST(request: NextRequest) {
  try {
    const nowMs = Date.now()
    const lockout = await evaluatePinLockout(request, nowMs)

    if (lockout.locked) {
      return lockoutResponse(lockout.retryAfterSeconds)
    }

    const body = (await request.json().catch(() => ({}))) as { pin?: unknown }
    const pin = typeof body.pin === "string" ? body.pin.trim() : ""
    if (!pin) {
      return authJson({ authenticated: false, error: "PIN is required" }, { status: 400 })
    }

    if (pin !== resolveExpectedPin()) {
      const failure = await recordPinFailure(request, nowMs)
      if (failure.locked) return lockoutResponse(failure.retryAfterSeconds)
      return authJson({ authenticated: false, error: "Invalid PIN" }, { status: 401 })
    }

    await clearPinFailures(request)
    const token = await createPinSessionToken(nowMs)
    const response = authJson({ authenticated: true })
    response.cookies.set({
      ...pinSessionCookieOptions(),
      value: token,
    })
    return response
  } catch {
    return authJson({ authenticated: false, error: "Authentication is temporarily unavailable" }, { status: 503 })
  }
}
