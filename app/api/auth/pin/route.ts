import { type NextRequest, NextResponse } from "next/server"
import { createPinSessionToken, pinSessionCookieOptions, resolveExpectedPin } from "../../../../lib/server/pinAuth"

type AttemptState = {
  count: number
  windowStart: number
  lockUntil: number
}

const attemptsByIp = new Map<string, AttemptState>()
const WINDOW_MS = 10 * 60 * 1000
const LOCKOUT_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return "unknown"
}

function cleanupOldAttempts(nowMs: number) {
  for (const [ip, state] of attemptsByIp.entries()) {
    if (state.lockUntil <= nowMs && nowMs - state.windowStart > WINDOW_MS) {
      attemptsByIp.delete(ip)
    }
  }
}

function evaluateLockout(ip: string, nowMs: number) {
  cleanupOldAttempts(nowMs)

  const state = attemptsByIp.get(ip)
  if (!state) return { locked: false, retryAfterSeconds: 0 }

  if (state.lockUntil > nowMs) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((state.lockUntil - nowMs) / 1000)),
    }
  }

  if (nowMs - state.windowStart > WINDOW_MS) {
    attemptsByIp.set(ip, { count: 0, windowStart: nowMs, lockUntil: 0 })
  }

  return { locked: false, retryAfterSeconds: 0 }
}

function recordFailedAttempt(ip: string, nowMs: number) {
  const state = attemptsByIp.get(ip)
  if (!state || nowMs - state.windowStart > WINDOW_MS) {
    attemptsByIp.set(ip, { count: 1, windowStart: nowMs, lockUntil: 0 })
    return
  }

  state.count += 1
  if (state.count >= MAX_ATTEMPTS) {
    state.lockUntil = nowMs + LOCKOUT_MS
    state.count = 0
    state.windowStart = nowMs
  }
}

function clearAttemptState(ip: string) {
  attemptsByIp.delete(ip)
}

export async function POST(request: NextRequest) {
  try {
    const nowMs = Date.now()
    const ip = getClientIp(request)
    const lockout = evaluateLockout(ip, nowMs)

    if (lockout.locked) {
      return NextResponse.json(
        {
          authenticated: false,
          error: "Too many failed attempts. Try again later.",
          retryAfterSeconds: lockout.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(lockout.retryAfterSeconds) },
        },
      )
    }

    const body = (await request.json().catch(() => ({}))) as { pin?: unknown }
    const pin = typeof body.pin === "string" ? body.pin.trim() : ""
    if (!pin) {
      return NextResponse.json({ authenticated: false, error: "PIN is required" }, { status: 400 })
    }

    if (pin !== resolveExpectedPin()) {
      recordFailedAttempt(ip, nowMs)
      return NextResponse.json({ authenticated: false, error: "Invalid PIN" }, { status: 401 })
    }

    clearAttemptState(ip)
    const token = await createPinSessionToken(nowMs)
    const response = NextResponse.json({ authenticated: true })
    response.cookies.set({
      ...pinSessionCookieOptions(),
      value: token,
    })
    return response
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, error: error instanceof Error ? error.message : "Authentication failed" },
      { status: 500 },
    )
  }
}
