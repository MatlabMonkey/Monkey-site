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

export type TrackedCaseRecord = TrackedCaseDraft & {
  id: string
  status: CaseStatus
  automation_state: CaseAutomationState
  version: number
  change_reason: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type CaseEventRecord = {
  id: number
  case_id: string
  entity_type: "case" | "task_link" | "dependency" | "evidence" | "escalation"
  entity_id: string
  event_type: string
  actor: string
  reason: string | null
  snapshot: Record<string, unknown>
  created_at: string
}

export type TrackedCaseTaskRecord = {
  case_id: string
  task_id: string
  role: (typeof CASE_TASK_ROLES)[number]
  created_at: string
}

export type CaseDependencyRecord = {
  id: string
  case_id: string
  blocked_task_id: string
  blocking_task_id: string
  state: (typeof CASE_DEPENDENCY_STATES)[number]
  rationale: string
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export type SetTrackedCaseTaskInput = {
  task_id: unknown
  role: unknown
  reason: unknown
}

export type RemoveTrackedCaseTaskInput = {
  task_id: unknown
  reason: unknown
}

export type CreateCaseDependencyInput = {
  blocked_task_id: unknown
  blocking_task_id: unknown
  rationale: unknown
}

export type ResolveCaseDependencyInput = {
  state: unknown
  reason: unknown
}

export type TrackedCaseUpdateInput = {
  expected_version: unknown
  reason: unknown
  title?: unknown
  outcome?: unknown
  status?: unknown
  automation_state?: unknown
  deadline_on?: unknown
  deadline_provenance_type?: unknown
  deadline_provenance_ref?: unknown
  deadline_confidence?: unknown
}

export type TrackedCaseUpdate = {
  expected_version: number
  reason: string
  changes: Partial<TrackedCaseDraft> & {
    status?: CaseStatus
    automation_state?: CaseAutomationState
  }
}

export class TrackedCaseNotFoundError extends Error {
  constructor(message = "Tracked case not found") {
    super(message)
    this.name = "TrackedCaseNotFoundError"
  }
}

export class TrackedCaseConflictError extends Error {
  constructor(message = "The tracked case changed before this operation completed") {
    super(message)
    this.name = "TrackedCaseConflictError"
  }
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

function normalizeEnum<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new TaskValidationError(`${field} must be one of: ${values.join(", ")}`)
  }
  return value as T
}

function normalizeReason(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TaskValidationError("reason is required")
  }
  const reason = value.trim().replace(/\s+/g, " ")
  if (reason.length > 2000) throw new TaskValidationError("reason must be 2000 characters or fewer")
  return reason
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

type DeadlineBundleInput = Pick<
  TrackedCaseInput,
  "deadline_on" | "deadline_provenance_type" | "deadline_provenance_ref" | "deadline_confidence"
>

function normalizeDeadlineBundle(input: DeadlineBundleInput): Pick<
  TrackedCaseDraft,
  "deadline_on" | "deadline_provenance_type" | "deadline_provenance_ref" | "deadline_confidence"
> {
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
    deadline_on: deadlineOn,
    deadline_provenance_type: provenanceType,
    deadline_provenance_ref: provenanceRef,
    deadline_confidence: confidence,
  }
}

export function normalizeTrackedCase(input: TrackedCaseInput): TrackedCaseDraft {
  return {
    title: normalizeTaskTitle(input.title),
    outcome: normalizeOutcome(input.outcome),
    ...normalizeDeadlineBundle(input),
  }
}

export function normalizeTrackedCaseUuid(value: unknown): string {
  return normalizeUuid(value, "case_id")
}

export function normalizeTrackedCaseTask(input: SetTrackedCaseTaskInput) {
  return {
    task_id: normalizeUuid(input.task_id, "task_id"),
    role: normalizeEnum(input.role, CASE_TASK_ROLES, "role"),
    reason: normalizeReason(input.reason),
  }
}

export function normalizeTrackedCaseTaskRemoval(input: RemoveTrackedCaseTaskInput) {
  return {
    task_id: normalizeUuid(input.task_id, "task_id"),
    reason: normalizeReason(input.reason),
  }
}

export function normalizeCaseDependency(input: CreateCaseDependencyInput) {
  const blockedTaskId = normalizeUuid(input.blocked_task_id, "blocked_task_id")
  const blockingTaskId = normalizeUuid(input.blocking_task_id, "blocking_task_id")
  if (blockedTaskId === blockingTaskId) {
    throw new TaskValidationError("A task cannot depend on itself")
  }
  return {
    blocked_task_id: blockedTaskId,
    blocking_task_id: blockingTaskId,
    rationale: normalizeReason(input.rationale),
  }
}

export function normalizeCaseDependencyResolution(input: ResolveCaseDependencyInput) {
  return {
    state: normalizeEnum(input.state, ["satisfied", "waived"] as const, "state"),
    reason: normalizeReason(input.reason),
  }
}

export function normalizeCaseDependencyUuid(value: unknown): string {
  return normalizeUuid(value, "dependency_id")
}

export function normalizeTrackedCaseUpdate(input: TrackedCaseUpdateInput): TrackedCaseUpdate {
  if (!Number.isInteger(input.expected_version) || (input.expected_version as number) < 1) {
    throw new TaskValidationError("expected_version must be a positive integer")
  }

  const changes: TrackedCaseUpdate["changes"] = {}
  if (input.title !== undefined) changes.title = normalizeTaskTitle(input.title)
  if (input.outcome !== undefined) changes.outcome = normalizeOutcome(input.outcome)
  if (input.status !== undefined) {
    changes.status = normalizeEnum(input.status, CASE_STATUSES, "status")
  }
  if (input.automation_state !== undefined) {
    changes.automation_state = normalizeEnum(
      input.automation_state,
      CASE_AUTOMATION_STATES,
      "automation_state",
    )
  }

  const deadlineKeys = [
    "deadline_on",
    "deadline_provenance_type",
    "deadline_provenance_ref",
    "deadline_confidence",
  ] as const
  const presentDeadlineKeys = deadlineKeys.filter((key) => Object.hasOwn(input, key))
  if (presentDeadlineKeys.length > 0 && presentDeadlineKeys.length !== deadlineKeys.length) {
    throw new TaskValidationError("all deadline fields must be updated together")
  }
  if (presentDeadlineKeys.length === deadlineKeys.length) {
    Object.assign(changes, normalizeDeadlineBundle(input))
  }

  if (Object.keys(changes).length === 0) {
    throw new TaskValidationError("No tracked case changes provided")
  }

  return {
    expected_version: input.expected_version as number,
    reason: normalizeReason(input.reason),
    changes,
  }
}
