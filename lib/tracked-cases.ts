import { normalizeDateOnly, normalizeOptionalText, normalizeTaskTitle, TaskValidationError } from "./tasks.ts"

export const CASE_STATUSES = ["active", "blocked", "completed", "cancelled"] as const
export const CASE_AUTOMATION_STATES = ["manual", "monitoring", "awaiting_approval", "paused", "finished"] as const
export const DEADLINE_PROVENANCE_TYPES = ["user", "external", "derived"] as const
export const CASE_TASK_ROLES = ["next_action", "milestone"] as const
export const CASE_DEPENDENCY_STATES = ["open", "satisfied", "waived"] as const
export const CASE_EVIDENCE_TYPES = ["message", "document", "receipt", "status", "other"] as const
export const CASE_ESCALATION_SEVERITIES = ["notice", "warning", "urgent"] as const
export const CASE_ESCALATION_STATES = ["open", "acknowledged", "resolved"] as const

export type CaseStatus = (typeof CASE_STATUSES)[number]
export type CaseAutomationState = (typeof CASE_AUTOMATION_STATES)[number]
export type DeadlineProvenanceType = (typeof DEADLINE_PROVENANCE_TYPES)[number]

export type TrackedCaseDraft = {
  title: string
  outcome: string
  deadline_on: string | null
  deadline_provenance_type: DeadlineProvenanceType | null
  deadline_provenance_ref: string | null
  deadline_confidence: number | null
}

export type TrackedCaseInput = {
  title: unknown
  outcome: unknown
  deadline_on?: unknown
  deadline_provenance_type?: unknown
  deadline_provenance_ref?: unknown
  deadline_confidence?: unknown
}

function normalizeOutcome(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TaskValidationError("outcome is required")
  }
  const outcome = value.trim().replace(/\s+/g, " ")
  if (outcome.length > 2000) throw new TaskValidationError("outcome must be 2000 characters or fewer")
  return outcome
}

function normalizeDeadlineProvenanceType(value: unknown): DeadlineProvenanceType | null {
  if (value === undefined || value === null || value === "") return null
  if (
    typeof value !== "string"
    || !DEADLINE_PROVENANCE_TYPES.includes(value as DeadlineProvenanceType)
  ) {
    throw new TaskValidationError("deadline_provenance_type must be user, external, or derived")
  }
  return value as DeadlineProvenanceType
}

function normalizeConfidence(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TaskValidationError("deadline_confidence must be a number from 0 to 1")
  }
  return value
}

export function normalizeTrackedCase(input: TrackedCaseInput): TrackedCaseDraft {
  const deadlineOn = normalizeDateOnly(input.deadline_on) ?? null
  const provenanceType = normalizeDeadlineProvenanceType(input.deadline_provenance_type)
  const provenanceRef = normalizeOptionalText(
    input.deadline_provenance_ref,
    "deadline_provenance_ref",
  ) ?? null
  const confidence = normalizeConfidence(input.deadline_confidence)
  const deadlineFields = [deadlineOn, provenanceType, provenanceRef, confidence]
  const hasAnyDeadlineField = deadlineFields.some((value) => value !== null)
  const hasAllDeadlineFields = deadlineFields.every((value) => value !== null)

  if (hasAnyDeadlineField && !hasAllDeadlineFields) {
    throw new TaskValidationError(
      "deadline_on, deadline_provenance_type, deadline_provenance_ref, and deadline_confidence must be supplied together",
    )
  }

  return {
    title: normalizeTaskTitle(input.title),
    outcome: normalizeOutcome(input.outcome),
    deadline_on: deadlineOn,
    deadline_provenance_type: provenanceType,
    deadline_provenance_ref: provenanceRef,
    deadline_confidence: confidence,
  }
}
