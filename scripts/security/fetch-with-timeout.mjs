const DEFAULT_TIMEOUT_MS = 10_000
const MAX_TIMEOUT_MS = 60_000

function resolveTimeoutMs() {
  const raw = process.env.SECURITY_HTTP_TIMEOUT_MS
  if (raw === undefined) return DEFAULT_TIMEOUT_MS

  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > MAX_TIMEOUT_MS) {
    throw new Error(`SECURITY_HTTP_TIMEOUT_MS must be an integer from 1 to ${MAX_TIMEOUT_MS}`)
  }
  return value
}

export async function fetchWithTimeout(input, init = {}) {
  if (init.signal) return fetch(input, init)

  const timeoutMs = resolveTimeoutMs()
  try {
    return await fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error(`security probe timed out after ${timeoutMs}ms`)
    }
    throw error
  }
}
