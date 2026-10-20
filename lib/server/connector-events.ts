import { createClient } from "@supabase/supabase-js"
import {
  ConnectorEventConflictError,
  ConnectorEventNotFoundError,
  normalizeEmailConnectorEvent,
  type ConnectorEventRecord,
  type EmailConnectorEventInput,
} from "../connector-events"
import type {
  CaseDependencyRecord,
  CaseEscalationRecord,
  CaseEvidenceRecord,
  TrackedCaseRecord,
} from "../tracked-cases"

export type IngestEmailConnectorEventResult = {
  event: ConnectorEventRecord
  case: TrackedCaseRecord
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

function throwConnectorDatabaseError(error: { message: string }): never {
  if (
    error.message.includes("tracked_case_not_found")
    || error.message.includes("case_dependency_not_found")
  ) {
    throw new ConnectorEventNotFoundError()
  }
  if (
    error.message.includes("email_connector_event_idempotency_conflict")
    || error.message.includes("case_evidence_idempotency_conflict")
  ) {
    throw new ConnectorEventConflictError()
  }
  if (error.message.includes("case_dependency_already_resolved")) {
    throw new ConnectorEventConflictError("The target dependency is already resolved")
  }
  if (error.message.includes("email_connector_terminal_case_conflict")) {
    throw new ConnectorEventConflictError("That signal cannot change a cancelled or completed case")
  }
  throw new Error(error.message)
}

export async function ingestEmailConnectorEvent(
  input: EmailConnectorEventInput,
): Promise<IngestEmailConnectorEventResult> {
  const event = normalizeEmailConnectorEvent(input)
  const { data, error } = await getSupabaseAdmin().rpc("ingest_email_connector_event", {
    p_case_id: event.case_id,
    p_provider: event.provider,
    p_event_id: event.event_id,
    p_message_id: event.message_id,
    p_thread_id: event.thread_id,
    p_observed_at: event.observed_at,
    p_content_sha256: event.content_sha256,
    p_signal: event.signal,
    p_rule: event.rule,
    p_summary: event.summary,
    p_dependency_id: event.dependency_id,
  })

  if (error) throwConnectorDatabaseError(error)
  return data as IngestEmailConnectorEventResult
}
