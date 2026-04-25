import { type NextRequest } from "next/server"

const encoder = new TextEncoder()

export const PIN_SESSION_COOKIE = "pin_session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14 // 14 days
const LEGACY_PIN_FALLBACK = "2245"

type PinSessionPayload = {
  v: 1
  iat: number
  exp: number
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromBase64Url(value: string): Uint8Array | null {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

function utf8ToBase64Url(value: string): string {
  return toBase64Url(encoder.encode(value))
}

function base64UrlToUtf8(value: string): string | null {
  const bytes = fromBase64Url(value)
  if (!bytes) return null
  try {
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function resolveSessionSecret(): string {
  const explicit = process.env.PIN_SESSION_SECRET?.trim()
  if (explicit) return explicit

  const fallback =
    process.env.CAPTURE_API_KEY?.trim() ||
    process.env.TODO_WEBHOOK_SECRET?.trim() ||
    process.env.WEBHOOK_SECRET?.trim() ||
    process.env.CONTACTS_API_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (fallback) return fallback
  throw new Error("Missing PIN_SESSION_SECRET and no server secret fallback is configured")
}

export function resolveExpectedPin(): string {
  return process.env.PIN_GATE_PIN?.trim() || LEGACY_PIN_FALLBACK
}

async function importSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(resolveSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

async function signPayload(payloadBase64Url: string): Promise<string> {
  const key = await importSigningKey()
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadBase64Url))
  return toBase64Url(new Uint8Array(signature))
}

async function verifySignature(payloadBase64Url: string, signatureBase64Url: string): Promise<boolean> {
  const key = await importSigningKey()
  const signature = fromBase64Url(signatureBase64Url)
  if (!signature) return false
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(payloadBase64Url))
}

export async function createPinSessionToken(nowMs = Date.now()): Promise<string> {
  const iat = Math.floor(nowMs / 1000)
  const exp = iat + SESSION_TTL_SECONDS
  const payload: PinSessionPayload = { v: 1, iat, exp }
  const payloadBase64Url = utf8ToBase64Url(JSON.stringify(payload))
  const signatureBase64Url = await signPayload(payloadBase64Url)
  return `${payloadBase64Url}.${signatureBase64Url}`
}

export async function verifyPinSessionToken(token: string | null | undefined, nowMs = Date.now()): Promise<boolean> {
  if (!token) return false
  const [payloadBase64Url, signatureBase64Url] = token.split(".")
  if (!payloadBase64Url || !signatureBase64Url) return false

  const signatureValid = await verifySignature(payloadBase64Url, signatureBase64Url)
  if (!signatureValid) return false

  const rawPayload = base64UrlToUtf8(payloadBase64Url)
  if (!rawPayload) return false

  try {
    const parsed = JSON.parse(rawPayload) as Partial<PinSessionPayload>
    if (parsed.v !== 1) return false
    if (typeof parsed.exp !== "number") return false
    const now = Math.floor(nowMs / 1000)
    return parsed.exp > now
  } catch {
    return false
  }
}

export async function isRequestAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(PIN_SESSION_COOKIE)?.value
  return verifyPinSessionToken(token)
}

export function pinSessionCookieOptions() {
  return {
    name: PIN_SESSION_COOKIE,
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  }
}
