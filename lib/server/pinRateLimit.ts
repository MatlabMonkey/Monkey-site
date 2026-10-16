import { createClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server.js"

type AttemptState = {
  count: number
  windowStart: number
  lockUntil: number
}

export type PinLockout = {
  locked: boolean
  retryAfterSeconds: number
}

const WINDOW_MS = 10 * 60 * 1000
const LOCKOUT_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const fallbackAttempts = new Map<string, AttemptState>()

function getClientIp(request: NextRequest): string {
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for")
  if (vercelForwardedFor) return vercelForwardedFor.split(",")[0].trim()
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return "unknown"
}

function resolveHashSecret(): string {
  const secret =
    process.env.PIN_RATE_LIMIT_SECRET?.trim() ||
    process.env.PIN_SESSION_SECRET?.trim() ||
    process.env.CAPTURE_API_KEY?.trim() ||
    process.env.TODO_WEBHOOK_SECRET?.trim() ||
    process.env.WEBHOOK_SECRET?.trim() ||
    process.env.CONTACTS_API_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!secret) throw new Error("Missing PIN rate-limit hashing secret")
  return secret
}

async function clientHash(request: NextRequest): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(resolveHashSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(getClientIp(request)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function distributedClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function retryAfter(data: unknown): number {
  const seconds = typeof data === "number" ? data : Number(data)
  return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0
}

function cleanupFallback(nowMs: number) {
  for (const [key, state] of fallbackAttempts.entries()) {
    if (state.lockUntil <= nowMs && nowMs - state.windowStart > WINDOW_MS) fallbackAttempts.delete(key)
  }
}

function fallbackCheck(key: string, nowMs: number): PinLockout {
  cleanupFallback(nowMs)
  const state = fallbackAttempts.get(key)
  if (!state || state.lockUntil <= nowMs) return { locked: false, retryAfterSeconds: 0 }
  return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil((state.lockUntil - nowMs) / 1000)) }
}

function fallbackRecordFailure(key: string, nowMs: number): PinLockout {
  const state = fallbackAttempts.get(key)
  if (!state || nowMs - state.windowStart > WINDOW_MS) {
    fallbackAttempts.set(key, { count: 1, windowStart: nowMs, lockUntil: 0 })
    return { locked: false, retryAfterSeconds: 0 }
  }

  state.count += 1
  if (state.count >= MAX_ATTEMPTS) {
    state.count = 0
    state.windowStart = nowMs
    state.lockUntil = nowMs + LOCKOUT_MS
    return { locked: true, retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000) }
  }

  return { locked: false, retryAfterSeconds: 0 }
}

async function distributedRetryAfter(
  functionName: "check_pin_auth_lockout" | "record_pin_auth_failure",
  key: string,
  nowMs: number,
): Promise<number | null> {
  const client = distributedClient()
  if (!client) return null

  const args: Record<string, unknown> = {
    p_client_hash: key,
    p_now: new Date(nowMs).toISOString(),
  }
  if (functionName === "record_pin_auth_failure") {
    args.p_window_seconds = WINDOW_MS / 1000
    args.p_max_attempts = MAX_ATTEMPTS
    args.p_lockout_seconds = LOCKOUT_MS / 1000
  }

  const { data, error } = await client.rpc(functionName, args)
  if (!error) return retryAfter(data)
  throw new Error("Distributed PIN rate limit is unavailable")
}

export async function evaluatePinLockout(request: NextRequest, nowMs = Date.now()): Promise<PinLockout> {
  const key = await clientHash(request)
  const distributedSeconds = await distributedRetryAfter("check_pin_auth_lockout", key, nowMs)
  if (distributedSeconds !== null) {
    return { locked: distributedSeconds > 0, retryAfterSeconds: distributedSeconds }
  }
  return fallbackCheck(key, nowMs)
}

export async function recordPinFailure(request: NextRequest, nowMs = Date.now()): Promise<PinLockout> {
  const key = await clientHash(request)
  const distributedSeconds = await distributedRetryAfter("record_pin_auth_failure", key, nowMs)
  if (distributedSeconds !== null) {
    return { locked: distributedSeconds > 0, retryAfterSeconds: distributedSeconds }
  }
  return fallbackRecordFailure(key, nowMs)
}

export async function clearPinFailures(request: NextRequest): Promise<void> {
  const key = await clientHash(request)
  const client = distributedClient()
  if (client) {
    const { error } = await client.rpc("clear_pin_auth_failures", { p_client_hash: key })
    if (!error) return
    throw new Error("Distributed PIN rate limit is unavailable")
  }
  fallbackAttempts.delete(key)
}
