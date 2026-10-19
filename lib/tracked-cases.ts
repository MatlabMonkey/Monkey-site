import { normalizeDateOnly, normalizeOptionalText, normalizeTaskTitle, TaskValidationError } from "./tasks.ts"

export const CASE_STATUSES = ["active", "blocked", "completed", "cancelled"] as const
export const CASE_AUTOMATION_STATES = ["manual", "monitoring", "awaiting_approval", "paused", "finished"] as const
export const DEADLINE_PROVENANCE_TYPES = ["user", "external", "derived"] as const
export const CASE_TASK_ROLES = ["next_action", "milestone"] as const
export const CASE_DEPENDENCY_STATES = ["open", "satisfied", "waived"] as const
export const CASE_EVIDENCE_TYPES = ["message", "document", "receipt", "status", "other"] as const
export const CASE_EVIDENCE_ACTIONS = ["record_only", "satisfy_dependency", "raise_exception"] as const
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

export type CaseEvidenceRecord = {
  id: string
  case_id: string
  dependency_id: string | null
  evidence_type: (typeof CASE_EVIDENCE_TYPES)[number]
  summary: string
  source: string
  source_id: string
  observed_at: string
  content_sha256: string | null
  reconciliation_action: (typeof CASE_EVIDENCE_ACTIONS)[number]
  reconciliation_rule: string
  recorded_by: string
  created_at: string
}

export type CaseEscalationRecord = {
  id: string
  case_id: string
  dependency_id: string | null
  evidence_id: string | null
  severity: (typeof CASE_ESCALATION_SEVERITIES)[number]
  state: (typeof CASE_ESCALATION_STATES)[number]
  reason: string
  opened_by: string
  acknowledged_by: string | null
  acknowledged_at: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export type ReconcileCaseEvidenceInput = {
  evidence_type: unknown
  summary: unknown
  source: unknown
  source_id: unknown
  observed_at: unknown
  content_sha256?: unknown
  reconciliation_action: unknown
  reconciliation_rule: unknown
  dependency_id?: unknown
  escalation_severity?: unknown
  escalation_reason?: unknown
}

export type ReconcileCaseEvidenceCommand = {
  evidence_type: (typeof CASE_EVIDENCE_TYPES)[number]
  summary: string
  source: string
  source_id: string
  observed_at: string
  content_sha256: string | null
  reconciliation_action: (typeof CASE_EVIDENCE_ACTIONS)[number]
  reconciliation_rule: string
  dependency_id: string | null
  escalation_severity: (typeof CASE_ESCALATION_SEVERITIES)[number] | null
  escalation_reason: string | null
}

export type UpdateCaseEscalationInput = {
  state: unknown
  reason: unknown
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

function normalizeBoundedText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TaskValidationError(`${field} is required`)
  }
  const normalized = value.trim().replace(/\s+/g, " ")
  if (normalized.length > maximum) {
    throw new TaskValidationError(`${field} must be ${maximum} characters or fewer`)
  }
  return normalized
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

export function normalizeCaseEscalationUuid(value: unknown): string {
  return normalizeUuid(value, "escalation_id")
}

export function normalizeCaseEvidence(input: ReconcileCaseEvidenceInput): ReconcileCaseEvidenceCommand {
  const action = normalizeEnum(
    input.reconciliation_action,
    CASE_EVIDENCE_ACTIONS,
    "reconciliation_action",
  )
  const source = normalizeBoundedText(input.source, "source", 50).toLowerCase()
  if (!/^[a-z][a-z0-9_-]{0,49}$/.test(source)) {
    throw new TaskValidationError(
      "source must start with a letter and contain only lowercase letters, numbers, _ or -",
    )
  }
  const observedAt = typeof input.observed_at === "string" ? new Date(input.observed_at) : null
  if (!observedAt || Number.isNaN(observedAt.getTime())) {
    throw new TaskValidationError("observed_at must be a valid timestamp")
  }
  const contentSha256 = input.content_sha256 === undefined
    || input.content_sha256 === null
    || input.content_sha256 === ""
    ? null
    : normalizeBoundedText(input.content_sha256, "content_sha256", 64).toLowerCase()
  if (contentSha256 !== null && !/^[0-9a-f]{64}$/.test(contentSha256)) {
    throw new TaskValidationError("content_sha256 must be a lowercase SHA-256 digest")
  }

  const dependencyId = input.dependency_id === undefined || input.dependency_id === null
    ? null
    : normalizeCaseDependencyUuid(input.dependency_id)
  const escalationSeverity = input.escalation_severity === undefined
    || input.escalation_severity === null
    ? null
    : normalizeEnum(input.escalation_severity, CASE_ESCALATION_SEVERITIES, "escalation_severity")
  const escalationReason = input.escalation_reason === undefined || input.escalation_reason === null
    ? null
    : normalizeReason(input.escalation_reason)

  if (action === "satisfy_dependency" && dependencyId === null) {
    throw new TaskValidationError("dependency_id is required to satisfy a dependency")
  }
  if (action !== "satisfy_dependency" && dependencyId !== null) {
    throw new TaskValidationError("dependency_id is only allowed when satisfying a dependency")
  }
  if (action === "raise_exception" && (escalationSeverity === null || escalationReason === null)) {
    throw new TaskValidationError(
      "escalation_severity and escalation_reason are required to raise an exception",
    )
  }
  if (action !== "raise_exception" && (escalationSeverity !== null || escalationReason !== null)) {
    throw new TaskValidationError("escalation fields are only allowed when raising an exception")
  }

  return {
    evidence_type: normalizeEnum(input.evidence_type, CASE_EVIDENCE_TYPES, "evidence_type"),
    summary: normalizeBoundedText(input.summary, "summary", 2000),
    source,
    source_id: normalizeBoundedText(input.source_id, "source_id", 500),
    observed_at: observedAt.toISOString(),
    content_sha256: contentSha256,
    reconciliation_action: action,
    reconciliation_rule: normalizeBoundedText(input.reconciliation_rule, "reconciliation_rule", 100),
    dependency_id: dependencyId,
    escalation_severity: escalationSeverity,
    escalation_reason: escalationReason,
  }
}

export function normalizeCaseEscalationUpdate(input: UpdateCaseEscalationInput) {
  return {
    state: normalizeEnum(input.state, ["acknowledged", "resolved"] as const, "state"),
    reason: normalizeReason(input.reason),
  }
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
