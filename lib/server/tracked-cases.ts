import { createClient } from "@supabase/supabase-js"
import {
  normalizeTrackedCase,
  normalizeTrackedCaseUpdate,
  normalizeTrackedCaseUuid,
  TrackedCaseConflictError,
  TrackedCaseNotFoundError,
  type CaseEventRecord,
  type TrackedCaseInput,
  type TrackedCaseRecord,
  type TrackedCaseUpdateInput,
} from "../tracked-cases"

export type TrackedCaseDetail = {
  case: TrackedCaseRecord
  events: CaseEventRecord[]
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
  ) {
    throw new TrackedCaseNotFoundError()
  }
  if (error.message.includes("tracked_case_version_conflict")) {
    throw new TrackedCaseConflictError()
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
  const [caseResult, eventResult] = await Promise.all([
    client.from("tracked_cases").select("*").eq("id", id).single(),
    client
      .from("case_events")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
  ])

  if (caseResult.error) throwTrackedCaseDatabaseError(caseResult.error)
  if (eventResult.error) throwTrackedCaseDatabaseError(eventResult.error)
  return {
    case: caseResult.data as TrackedCaseRecord,
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
