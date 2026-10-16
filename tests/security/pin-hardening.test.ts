import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { NextRequest } from "next/server.js"
import {
  createPinSessionToken,
  pinSessionCookieOptions,
  verifyPinSessionToken,
} from "../../lib/server/pinAuth.ts"
import { clearPinFailures, evaluatePinLockout, recordPinFailure } from "../../lib/server/pinRateLimit.ts"

test("fallback PIN limiter locks a client after five failures", async () => {
  const previous = {
    sessionSecret: process.env.PIN_SESSION_SECRET,
    rateLimitSecret: process.env.PIN_RATE_LIMIT_SECRET,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    publicSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  }

  process.env.PIN_SESSION_SECRET = "synthetic-pin-rate-limit-secret"
  delete process.env.PIN_RATE_LIMIT_SECRET
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_URL

  const request = new NextRequest("https://example.test/api/auth/pin", {
    headers: { "x-vercel-forwarded-for": "192.0.2.50", "x-forwarded-for": "198.51.100.1" },
  })
  const sameClientWithSpoofedForwarding = new NextRequest("https://example.test/api/auth/pin", {
    headers: { "x-vercel-forwarded-for": "192.0.2.50", "x-forwarded-for": "203.0.113.99" },
  })
  const nowMs = Date.UTC(2026, 9, 16, 15, 0, 0)

  try {
    assert.deepEqual(await evaluatePinLockout(request, nowMs), { locked: false, retryAfterSeconds: 0 })
    for (let attempt = 0; attempt < 4; attempt += 1) {
      assert.deepEqual(await recordPinFailure(request, nowMs + attempt), { locked: false, retryAfterSeconds: 0 })
    }
    assert.deepEqual(await recordPinFailure(request, nowMs + 4), { locked: true, retryAfterSeconds: 900 })
    assert.deepEqual(await evaluatePinLockout(sameClientWithSpoofedForwarding, nowMs + 5), {
      locked: true,
      retryAfterSeconds: 900,
    })
    await clearPinFailures(request)
    assert.deepEqual(await evaluatePinLockout(request, nowMs + 6), { locked: false, retryAfterSeconds: 0 })
  } finally {
    for (const [name, value] of Object.entries({
      PIN_SESSION_SECRET: previous.sessionSecret,
      PIN_RATE_LIMIT_SECRET: previous.rateLimitSecret,
      SUPABASE_SERVICE_ROLE_KEY: previous.serviceKey,
      SUPABASE_URL: previous.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_URL: previous.publicSupabaseUrl,
    })) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

test("PIN session tokens reject tampering and expiry and use hardened cookies", async () => {
  const previousSecret = process.env.PIN_SESSION_SECRET
  process.env.PIN_SESSION_SECRET = "synthetic-pin-session-secret"
  const issuedAt = Date.UTC(2026, 9, 16, 15, 0, 0)

  try {
    const token = await createPinSessionToken(issuedAt)
    assert.equal(await verifyPinSessionToken(token, issuedAt + 1_000), true)
    assert.equal(await verifyPinSessionToken(`${token}x`, issuedAt + 1_000), false)
    assert.equal(await verifyPinSessionToken(token, issuedAt + 14 * 24 * 60 * 60 * 1_000), false)
    assert.deepEqual(pinSessionCookieOptions(), {
      name: "pin_session",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 14 * 24 * 60 * 60,
      priority: "high",
    })
  } finally {
    if (previousSecret === undefined) delete process.env.PIN_SESSION_SECRET
    else process.env.PIN_SESSION_SECRET = previousSecret
  }
})

test("PIN hardening keeps auth state private and the shared store service-role-only", () => {
  const nextConfig = readFileSync("next.config.ts", "utf8")
  const pinRoute = readFileSync("app/api/auth/pin/route.ts", "utf8")
  const pinAuth = readFileSync("lib/server/pinAuth.ts", "utf8")
  const proxy = readFileSync("proxy.ts", "utf8")
  const migration = readFileSync("supabase/migrations/027_pin_auth_rate_limit.sql", "utf8")

  for (const header of [
    "Content-Security-Policy",
    "Permissions-Policy",
    "Referrer-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
  ]) {
    assert.match(nextConfig, new RegExp(header))
  }
  assert.match(pinRoute, /private, no-store, max-age=0/)
  assert.match(pinRoute, /if \(failure\.locked\) return lockoutResponse/)
  assert.match(pinRoute, /"Retry-After"/)
  assert.match(pinAuth, /secure: process\.env\.NODE_ENV === "production"/)
  assert.match(proxy, /private, no-store, max-age=0/)
  assert.match(migration, /REVOKE ALL ON TABLE public\.pin_auth_attempts FROM PUBLIC, anon, authenticated/i)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.record_pin_auth_failure/i)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.record_pin_auth_failure[\s\S]*TO service_role/i)
})
