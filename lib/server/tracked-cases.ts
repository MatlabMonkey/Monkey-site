import { createClient } from "@supabase/supabase-js"
import {
  normalizeCaseDependency,
  normalizeCaseDependencyResolution,
  normalizeCaseDependencyUuid,
  normalizeCaseEscalationUpdate,
  normalizeCaseEscalationUuid,
  normalizeCaseEvidence,
  normalizeTrackedCase,
  normalizeTrackedCaseTask,
  normalizeTrackedCaseTaskRemoval,
  normalizeTrackedCaseUpdate,
  normalizeTrackedCaseUuid,
  TrackedCaseConflictError,
  TrackedCaseNotFoundError,
  type CaseEventRecord,
  type CaseDependencyRecord,
  type CaseEscalationRecord,
  type CaseEvidenceRecord,
  type CreateCaseDependencyInput,
  type RemoveTrackedCaseTaskInput,
  type ReconcileCaseEvidenceInput,
  type ResolveCaseDependencyInput,
  type SetTrackedCaseTaskInput,
  type TrackedCaseInput,
  type TrackedCaseRecord,
  type TrackedCaseTaskRecord,
  type TrackedCaseUpdateInput,
  type UpdateCaseEscalationInput,
} from "../tracked-cases"
import type { TaskRecord } from "../tasks"

export type TrackedCaseDetail = {
  case: TrackedCaseRecord
  tasks: Array<TrackedCaseTaskRecord & { task: TaskRecord }>
  dependencies: CaseDependencyRecord[]
  evidence: CaseEvidenceRecord[]
  escalations: CaseEscalationRecord[]
  events: CaseEventRecord[]
}

export type ReconcileCaseEvidenceResult = {
  evidence: CaseEvidenceRecord
  dependency: CaseDependencyRecord | null
  escalation: CaseEscalationRecord | null
  replayed: boolean
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false } })
}

function throwTrackedCaseDatabaseError(error: { code?: string; message: string }): never {
  if (
    error.code === "PGRST116"
    || error.message.includes("tracked_case_not_found")
    || error.message.includes("tracked_case_task_not_found")
    || error.message.includes("case_dependency_not_found")
    || error.message.includes("case_escalation_not_found")
    || error.message.includes("task_not_found")
  ) {
    throw new TrackedCaseNotFoundError("Tracked case resource not found")
  }
  if (error.message.includes("tracked_case_version_conflict")) {
    throw new TrackedCaseConflictError()
  }
  if (error.message.includes("case_task_has_dependencies")) {
    throw new TrackedCaseConflictError("Resolve and remove task dependencies before detaching it")
  }
  if (error.message.includes("case_dependency_already_resolved")) {
    throw new TrackedCaseConflictError("The dependency is already resolved")
  }
  if (error.message.includes("case_evidence_idempotency_conflict")) {
    throw new TrackedCaseConflictError("That evidence source identity was already used with different data")
  }
  if (error.message.includes("case_escalation_already_transitioned")) {
    throw new TrackedCaseConflictError("The escalation has already advanced past that state")
  }
  if (error.code === "23505" || error.message.includes("case_dependency_already_exists")) {
    throw new TrackedCaseConflictError("An open dependency between these tasks already exists")
  }
  throw new Error(error.message)
}

export async function listTrackedCases(): Promise<TrackedCaseRecord[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("tracked_cases")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200)

  if (error) throwTrackedCaseDatabaseError(error)
  return (data || []) as TrackedCaseRecord[]
}

export async function getTrackedCase(caseId: unknown): Promise<TrackedCaseDetail> {
  const id = normalizeTrackedCaseUuid(caseId)
  const client = getSupabaseAdmin()
  const [caseResult, taskResult, dependencyResult, evidenceResult, escalationResult, eventResult] = await Promise.all([
    client.from("tracked_cases").select("*").eq("id", id).single(),
    client
      .from("tracked_case_tasks")
      .select("*, task:tasks(*)")
      .eq("case_id", id)
      .order("created_at", { ascending: true }),
    client
      .from("case_dependencies")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: true }),
    client
      .from("case_evidence")
      .select("*")
      .eq("case_id", id)
      .order("observed_at", { ascending: false }),
    client
      .from("case_escalations")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    client
      .from("case_events")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
  ])

  if (caseResult.error) throwTrackedCaseDatabaseError(caseResult.error)
  if (taskResult.error) throwTrackedCaseDatabaseError(taskResult.error)
  if (dependencyResult.error) throwTrackedCaseDatabaseError(dependencyResult.error)
  if (evidenceResult.error) throwTrackedCaseDatabaseError(evidenceResult.error)
  if (escalationResult.error) throwTrackedCaseDatabaseError(escalationResult.error)
  if (eventResult.error) throwTrackedCaseDatabaseError(eventResult.error)
  return {
    case: caseResult.data as TrackedCaseRecord,
    tasks: (taskResult.data || []) as Array<TrackedCaseTaskRecord & { task: TaskRecord }>,
    dependencies: (dependencyResult.data || []) as CaseDependencyRecord[],
    evidence: (evidenceResult.data || []) as CaseEvidenceRecord[],
    escalations: (escalationResult.data || []) as CaseEscalationRecord[],
    events: (eventResult.data || []) as CaseEventRecord[],
  }
}

export async function createTrackedCase(input: TrackedCaseInput): Promise<TrackedCaseRecord> {
  const trackedCase = normalizeTrackedCase(input)
  const { data, error } = await getSupabaseAdmin().rpc("create_tracked_case", {
    p_title: trackedCase.title,
    p_outcome: trackedCase.outcome,
    p_deadline_on: trackedCase.deadline_on,
    p_deadline_provenance_type: trackedCase.deadline_provenance_type,
    p_deadline_provenance_ref: trackedCase.deadline_provenance_ref,
    p_deadline_confidence: trackedCase.deadline_confidence,
    p_actor: "user",
  })

  if (error) throwTrackedCaseDatabaseError(error)
  return data as TrackedCaseRecord
}

export async function updateTrackedCase(
  caseId: unknown,
  input: TrackedCaseUpdateInput,
): Promise<TrackedCaseRecord> {
  const id = normalizeTrackedCaseUuid(caseId)
  const update = normalizeTrackedCaseUpdate(input)
  const { data, error } = await getSupabaseAdmin().rpc("update_tracked_case", {
    p_case_id: id,
    p_expected_version: update.expected_version,
    p_changes: update.changes,
    p_actor: "user",
    p_reason: update.reason,
  })

  if (error) throwTrackedCaseDatabaseError(error)
  return data as TrackedCaseRecord
}

export async function setTrackedCaseTask(
  caseId: unknown,
  input: SetTrackedCaseTaskInput,
): Promise<TrackedCaseTaskRecord> {
  const id = normalizeTrackedCaseUuid(caseId)
  const task = normalizeTrackedCaseTask(input)
  const { data, error } = await getSupabaseAdmin().rpc("set_tracked_case_task", {
    p_case_id: id,
    p_task_id: task.task_id,
    p_role: task.role,
    p_actor: "user",
    p_reason: task.reason,
  })

  if (error) throwTrackedCaseDatabaseError(error)
  return data as TrackedCaseTaskRecord
}

export async function removeTrackedCaseTask(
  caseId: unknown,
  input: RemoveTrackedCaseTaskInput,
): Promise<TrackedCaseTaskRecord> {
  const id = normalizeTrackedCaseUuid(caseId)
  const task = normalizeTrackedCaseTaskRemoval(input)
  const { data, error } = await getSupabaseAdmin().rpc("remove_tracked_case_task", {
    p_case_id: id,
    p_task_id: task.task_id,
    p_actor: "user",
    p_reason: task.reason,
  })

  if (error) throwTrackedCaseDatabaseError(error)
  return data as TrackedCaseTaskRecord
}

export async function createCaseDependency(
  caseId: unknown,
  input: CreateCaseDependencyInput,
): Promise<CaseDependencyRecord> {
  const id = normalizeTrackedCaseUuid(caseId)
  const dependency = normalizeCaseDependency(input)
  const { data, error } = await getSupabaseAdmin().rpc("create_case_dependency", {
    p_case_id: id,
    p_blocked_task_id: dependency.blocked_task_id,
    p_blocking_task_id: dependency.blocking_task_id,
    p_rationale: dependency.rationale,
    p_actor: "user",
  })

  if (error) throwTrackedCaseDatabaseError(error)
  return data as CaseDependencyRecord
}

export async function resolveCaseDependency(
  caseId: unknown,
  dependencyId: unknown,
  input: ResolveCaseDependencyInput,
): Promise<CaseDependencyRecord> {
  const id = normalizeTrackedCaseUuid(caseId)
  const dependencyIdValue = normalizeCaseDependencyUuid(dependencyId)
  const resolution = normalizeCaseDependencyResolution(input)
  const { data, error } = await getSupabaseAdmin().rpc("resolve_case_dependency", {
    p_case_id: id,
    p_dependency_id: dependencyIdValue,
    p_state: resolution.state,
    p_actor: "user",
    p_reason: resolution.reason,
  })

  if (error) throwTrackedCaseDatabaseError(error)
  return data as CaseDependencyRecord
}

export async function reconcileCaseEvidence(
  caseId: unknown,
  input: ReconcileCaseEvidenceInput,
): Promise<ReconcileCaseEvidenceResult> {
  const id = normalizeTrackedCaseUuid(caseId)
  const evidence = normalizeCaseEvidence(input)
  const { data, error } = await getSupabaseAdmin().rpc("reconcile_case_evidence", {
    p_case_id: id,
    p_evidence_type: evidence.evidence_type,
    p_summary: evidence.summary,
    p_source: evidence.source,
    p_source_id: evidence.source_id,
    p_observed_at: evidence.observed_at,
    p_content_sha256: evidence.content_sha256,
    p_reconciliation_action: evidence.reconciliation_action,
    p_reconciliation_rule: evidence.reconciliation_rule,
    p_dependency_id: evidence.dependency_id,
    p_escalation_severity: evidence.escalation_severity,
    p_escalation_reason: evidence.escalation_reason,
    p_actor: "user",
  })

  if (error) throwTrackedCaseDatabaseError(error)
  return data as ReconcileCaseEvidenceResult
}

export async function updateCaseEscalation(
  caseId: unknown,
  escalationId: unknown,
  input: UpdateCaseEscalationInput,
): Promise<CaseEscalationRecord> {
  const id = normalizeTrackedCaseUuid(caseId)
  const escalationIdValue = normalizeCaseEscalationUuid(escalationId)
  const update = normalizeCaseEscalationUpdate(input)
  const { data, error } = await getSupabaseAdmin().rpc("update_case_escalation", {
    p_case_id: id,
    p_escalation_id: escalationIdValue,
    p_state: update.state,
    p_actor: "user",
    p_reason: update.reason,
  })

  if (error) throwTrackedCaseDatabaseError(error)
  return data as CaseEscalationRecord
}
