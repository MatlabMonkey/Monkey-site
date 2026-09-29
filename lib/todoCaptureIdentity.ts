export class TodoValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TodoValidationError"
  }
}

export type TodoCaptureIdentity = {
  source: string
  source_id: string | null
  idempotency_key: string | null
}

export function normalizeTodoCaptureIdentity(input: {
  source?: unknown
  source_id?: unknown
  idempotency_key?: unknown
}): TodoCaptureIdentity {
  return {
    source: normalizeSource(input.source),
    source_id: normalizeIdentity(input.source_id, "source_id"),
    idempotency_key: normalizeIdentity(input.idempotency_key, "idempotency_key"),
  }
}

function normalizeSource(value: unknown): string {
  if (value === undefined || value === null) return "app"
  if (typeof value !== "string" || !value.trim()) {
    throw new TodoValidationError("source must be a non-empty string")
  }

  const source = value.trim()
  if (source.length > 80) {
    throw new TodoValidationError("source must be 80 characters or fewer")
  }
  return source
}

function normalizeIdentity(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") {
    throw new TodoValidationError(`${fieldName} must be a string or null`)
  }

  const identity = value.trim()
  if (!identity) return null
  if (identity.length > 255) {
    throw new TodoValidationError(`${fieldName} must be 255 characters or fewer`)
  }
  return identity
}
