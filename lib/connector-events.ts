import { TaskValidationError } from "./tasks.ts"

export const EMAIL_CONNECTOR_SIGNALS = ["advance", "block", "complete"] as const

export type EmailConnectorSignal = (typeof EMAIL_CONNECTOR_SIGNALS)[number]

export type EmailConnectorEventInput = {
  case_id: unknown
  provider: unknown
  event_id: unknown
  message_id: unknown
  thread_id?: unknown
  observed_at: unknown
  content_sha256: unknown
  signal: unknown
  rule: unknown
  summary: unknown
  dependency_id?: unknown
}

export type EmailConnectorEventCommand = {
  case_id: string
  provider: string
  event_id: string
  message_id: string
  thread_id: string | null
  observed_at: string
  content_sha256: string
  signal: EmailConnectorSignal
  rule: string
  summary: string
  dependency_id: string | null
}

export type ConnectorEventRecord = {
  id: string
  connector: "email"
  provider: string
  source_event_id: string
  source_message_id: string
  source_thread_id: string | null
  case_id: string
  evidence_id: string
  dependency_id: string | null
  escalation_id: string | null
  signal: EmailConnectorSignal
  rule: string
  summary: string
  observed_at: string
  content_sha256: string
  recorded_by: string
  created_at: string
}

export class ConnectorEventConflictError extends Error {
  constructor(message = "That connector event identity was already used with different data") {
    super(message)
    this.name = "ConnectorEventConflictError"
  }
}

export class ConnectorEventNotFoundError extends Error {
  constructor(message = "Tracked connector resource not found") {
    super(message)
    this.name = "ConnectorEventNotFoundError"
  }
}

function normalizeUuid(value: unknown, field: string): string {
  if (
    typeof value !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new TaskValidationError(`${field} must be a UUID`)
  }
  return value.toLowerCase()
}

function normalizeText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TaskValidationError(`${field} is required`)
  }
  const normalized = value.trim().replace(/\s+/g, " ")
  if (normalized.length > maximum) {
    throw new TaskValidationError(`${field} must be ${maximum} characters or fewer`)
  }
  return normalized
}

function normalizeOptionalText(value: unknown, field: string, maximum: number): string | null {
  if (value === undefined || value === null || value === "") return null
  return normalizeText(value, field, maximum)
}

function normalizeMachineName(value: unknown, field: string, maximum: number): string {
  const normalized = normalizeText(value, field, maximum).toLowerCase()
  if (!/^[a-z][a-z0-9_.-]*$/.test(normalized)) {
    throw new TaskValidationError(
      `${field} must start with a letter and contain only lowercase letters, numbers, _, . or -`,
    )
  }
  return normalized
}

export function normalizeEmailConnectorEvent(
  input: EmailConnectorEventInput,
): EmailConnectorEventCommand {
  const provider = normalizeMachineName(input.provider, "provider", 40)
  if (!/^[a-z][a-z0-9_-]*$/.test(provider)) {
    throw new TaskValidationError(
      "provider must start with a letter and contain only lowercase letters, numbers, _ or -",
    )
  }

  const signal = normalizeMachineName(input.signal, "signal", 20)
  if (!EMAIL_CONNECTOR_SIGNALS.includes(signal as EmailConnectorSignal)) {
    throw new TaskValidationError(`signal must be one of: ${EMAIL_CONNECTOR_SIGNALS.join(", ")}`)
  }

  const observedAt = typeof input.observed_at === "string" ? new Date(input.observed_at) : null
  if (!observedAt || Number.isNaN(observedAt.getTime())) {
    throw new TaskValidationError("observed_at must be a valid timestamp")
  }

  const contentSha256 = normalizeText(input.content_sha256, "content_sha256", 64).toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(contentSha256)) {
    throw new TaskValidationError("content_sha256 must be a lowercase SHA-256 digest")
  }

  const dependencyId = input.dependency_id === undefined || input.dependency_id === null
    ? null
    : normalizeUuid(input.dependency_id, "dependency_id")
  if (signal === "advance" && dependencyId === null) {
    throw new TaskValidationError("dependency_id is required for an advance signal")
  }
  if (signal !== "advance" && dependencyId !== null) {
    throw new TaskValidationError("dependency_id is only allowed for an advance signal")
  }

  return {
    case_id: normalizeUuid(input.case_id, "case_id"),
    provider,
    event_id: normalizeText(input.event_id, "event_id", 500),
    message_id: normalizeText(input.message_id, "message_id", 500),
    thread_id: normalizeOptionalText(input.thread_id, "thread_id", 500),
    observed_at: observedAt.toISOString(),
    content_sha256: contentSha256,
    signal: signal as EmailConnectorSignal,
    rule: normalizeMachineName(input.rule, "rule", 100),
    summary: normalizeText(input.summary, "summary", 2000),
    dependency_id: dependencyId,
  }
}
