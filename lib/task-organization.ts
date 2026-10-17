import {
  normalizeDateOnly,
  normalizeOptionalText,
  normalizeTaskStatus,
  normalizeTaskTitle,
  TaskValidationError,
  type TaskStatus,
} from "./tasks.ts"

export const ORGANIZATION_BOUNDARIES = ["auto_apply", "needs_review"] as const
export const ORGANIZATION_REVIEW_STATES = ["pending", "applied", "rejected", "superseded"] as const
export const ORGANIZATION_REVIEW_ACTIONS = ["apply", "reject", "supersede"] as const

export type OrganizationBoundary = (typeof ORGANIZATION_BOUNDARIES)[number]
export type OrganizationReviewState = (typeof ORGANIZATION_REVIEW_STATES)[number]
export type OrganizationReviewAction = (typeof ORGANIZATION_REVIEW_ACTIONS)[number]

export type TaskOrganizationChanges = {
  title?: string
  notes?: string | null
  status?: TaskStatus
  due_on?: string | null
  waiting_on?: string | null
}

export type TaskOrganizationProposalDraft = {
  task_id: string
  task_version: number
  changes: TaskOrganizationChanges
  confidence: number
  boundary: OrganizationBoundary
  rationale: string
  rule_id: string
}

export type TaskOrganizationProposalInput = {
  task_id: unknown
  task_version: unknown
  changes: unknown
  confidence: unknown
  rationale: unknown
  rule_id: unknown
}

export type TaskOrganizationProposalRecord = TaskOrganizationProposalDraft & {
  id: string
  state: OrganizationReviewState
  created_by: string
  reviewer: string | null
  review_reason: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export type TaskOrganizationReviewInput = {
  action: unknown
  reviewer: unknown
  reason: unknown
}

export type NormalizedTaskOrganizationReview = {
  state: Exclude<OrganizationReviewState, "pending">
  reviewer: string
  reason: string
}

export class TaskOrganizationConflictError extends Error {
  proposal?: TaskOrganizationProposalRecord

  constructor(message: string, proposal?: TaskOrganizationProposalRecord) {
    super(message)
    this.name = "TaskOrganizationConflictError"
    this.proposal = proposal
  }
}

export class TaskOrganizationNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TaskOrganizationNotFoundError"
  }
}

function normalizeIdentifier(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(value)) {
    throw new TaskValidationError(`${field} must be a short machine-readable identifier`)
  }
  return value
}

export function normalizeOrganizationUuid(value: unknown, field: string): string {
  if (
    typeof value !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new TaskValidationError(`${field} must be a UUID`)
  }
  return value.toLowerCase()
}

function normalizeVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new TaskValidationError("task_version must be a positive integer")
  }
  return value as number
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TaskValidationError("confidence must be a number from 0 to 1")
  }
  return value
}

function normalizeRationale(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TaskValidationError("rationale is required")
  }
  const rationale = value.trim().replace(/\s+/g, " ")
  if (rationale.length > 2000) throw new TaskValidationError("rationale must be 2000 characters or fewer")
  return rationale
}

function normalizeChanges(value: unknown): TaskOrganizationChanges {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TaskValidationError("changes must be an object")
  }

  const input = value as Record<string, unknown>
  const supported = new Set(["title", "notes", "status", "due_on", "waiting_on"])
  const unknownField = Object.keys(input).find((key) => !supported.has(key))
  if (unknownField) throw new TaskValidationError(`Unsupported organization field: ${unknownField}`)

  const changes: TaskOrganizationChanges = {}
  if (input.title !== undefined) changes.title = normalizeTaskTitle(input.title)
  if (input.notes !== undefined) changes.notes = normalizeOptionalText(input.notes, "notes") ?? null
  if (input.status !== undefined) changes.status = normalizeTaskStatus(input.status)!
  if (input.due_on !== undefined) changes.due_on = normalizeDateOnly(input.due_on) ?? null
  if (input.waiting_on !== undefined) changes.waiting_on = normalizeOptionalText(input.waiting_on, "waiting_on") ?? null

  if (Object.keys(changes).length === 0) {
    throw new TaskValidationError("At least one organization change is required")
  }
  return changes
}

export function organizationBoundaryFor(
  changes: TaskOrganizationChanges,
  confidence: number,
): OrganizationBoundary {
  const fields = Object.keys(changes)
  const isSafeRoute = fields.length === 1 && (changes.status === "today" || changes.status === "later")
  return isSafeRoute && confidence >= 0.9 ? "auto_apply" : "needs_review"
}

export function normalizeOrganizationProposal(
  input: TaskOrganizationProposalInput,
): TaskOrganizationProposalDraft {
  const changes = normalizeChanges(input.changes)
  const confidence = normalizeConfidence(input.confidence)

  return {
    task_id: normalizeOrganizationUuid(input.task_id, "task_id"),
    task_version: normalizeVersion(input.task_version),
    changes,
    confidence,
    boundary: organizationBoundaryFor(changes, confidence),
    rationale: normalizeRationale(input.rationale),
    rule_id: normalizeIdentifier(input.rule_id, "rule_id"),
  }
}

export function normalizeOrganizationReview(
  input: TaskOrganizationReviewInput,
): NormalizedTaskOrganizationReview {
  if (
    typeof input.action !== "string"
    || !ORGANIZATION_REVIEW_ACTIONS.includes(input.action as OrganizationReviewAction)
  ) {
    throw new TaskValidationError("action must be apply, reject, or supersede")
  }

  const states: Record<OrganizationReviewAction, Exclude<OrganizationReviewState, "pending">> = {
    apply: "applied",
    reject: "rejected",
    supersede: "superseded",
  }

  return {
    state: states[input.action as OrganizationReviewAction],
    reviewer: normalizeIdentifier(input.reviewer, "reviewer"),
    reason: normalizeRationale(input.reason),
  }
}

export function parseOrganizationReviewState(value: string | null): OrganizationReviewState {
  return value && ORGANIZATION_REVIEW_STATES.includes(value as OrganizationReviewState)
    ? value as OrganizationReviewState
    : "pending"
}
