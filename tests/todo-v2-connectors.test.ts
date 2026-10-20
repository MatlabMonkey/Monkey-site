import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  EMAIL_CONNECTOR_SIGNALS,
  normalizeEmailConnectorEvent,
} from "../lib/connector-events.ts"
import { TaskValidationError } from "../lib/tasks.ts"

const caseId = "123e4567-e89b-42d3-a456-426614174000"
const dependencyId = "223e4567-e89b-42d3-a456-426614174000"
const baseEvent = {
  case_id: caseId.toUpperCase(),
  provider: " IMAP ",
  event_id: " evt-42 ",
  message_id: " <message-42@example.test> ",
  thread_id: " thread-7 ",
  observed_at: "2026-10-19T01:15:00-07:00",
  content_sha256: "A".repeat(64),
  signal: "advance",
  rule: " EMAIL.DEPENDENCY-CONFIRMATION.V1 ",
  summary: "  Vendor confirmed   the shipment. ",
  dependency_id: dependencyId.toUpperCase(),
}

test("email connector events normalize bounded metadata deterministically", () => {
  const normalized = normalizeEmailConnectorEvent(baseEvent)

  assert.deepEqual(normalized, normalizeEmailConnectorEvent(structuredClone(baseEvent)))
  assert.deepEqual(normalized, {
    case_id: caseId,
    provider: "imap",
    event_id: "evt-42",
    message_id: "<message-42@example.test>",
    thread_id: "thread-7",
    observed_at: "2026-10-19T08:15:00.000Z",
    content_sha256: "a".repeat(64),
    signal: "advance",
    rule: "email.dependency-confirmation.v1",
    summary: "Vendor confirmed the shipment.",
    dependency_id: dependencyId,
  })
})

test("email connector signals have explicit, unambiguous targets", () => {
  assert.deepEqual(EMAIL_CONNECTOR_SIGNALS, ["advance", "block", "complete"])

  for (const signal of ["block", "complete"] as const) {
    const normalized = normalizeEmailConnectorEvent({
      ...baseEvent,
      event_id: `event-${signal}`,
      signal,
      dependency_id: undefined,
    })
    assert.equal(normalized.signal, signal)
    assert.equal(normalized.dependency_id, null)
  }

  assert.throws(
    () => normalizeEmailConnectorEvent({ ...baseEvent, dependency_id: undefined }),
    /dependency_id is required for an advance signal/,
  )
  assert.throws(
    () => normalizeEmailConnectorEvent({ ...baseEvent, signal: "block" }),
    /dependency_id is only allowed for an advance signal/,
  )
  assert.throws(
    () => normalizeEmailConnectorEvent({ ...baseEvent, signal: "guess" }),
    /signal must be one of/,
  )
})

test("email connector events reject ambiguous provenance", () => {
  assert.throws(
    () => normalizeEmailConnectorEvent({ ...baseEvent, provider: "Gmail account" }),
    /provider must start with a letter/,
  )
  assert.throws(
    () => normalizeEmailConnectorEvent({ ...baseEvent, provider: "gmail.api" }),
    /provider must start with a letter/,
  )
  assert.throws(
    () => normalizeEmailConnectorEvent({ ...baseEvent, rule: "free text rule!" }),
    /rule must start with a letter/,
  )
  assert.throws(
    () => normalizeEmailConnectorEvent({ ...baseEvent, content_sha256: "not-a-hash" }),
    /lowercase SHA-256 digest/,
  )
  assert.throws(
    () => normalizeEmailConnectorEvent({ ...baseEvent, observed_at: "tomorrow" }),
    /valid timestamp/,
  )
  assert.throws(
    () => normalizeEmailConnectorEvent({ ...baseEvent, event_id: " " }),
    TaskValidationError,
  )
})

test("email connector migration is atomic, replay-safe, provenance-preserving, and server-only", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/031_email_connector_events.sql", import.meta.url),
    "utf8",
  )

  assert.match(sql, /CREATE TABLE connector_events/)
  assert.match(sql, /message bodies and addresses are never stored/)
  assert.match(sql, /UNIQUE \(connector, provider, source_event_id\)/)
  assert.match(sql, /evidence_source := 'email_' \|\| normalized_provider/)
  assert.match(sql, /content_sha256 TEXT NOT NULL/)
  assert.match(sql, /signal IN \('advance', 'block', 'complete'\)/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION ingest_email_connector_event/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /email_connector_event_idempotency_conflict/)
  assert.match(sql, /reconcile_case_evidence\(/)
  assert.match(sql, /WHEN p_signal = 'advance' THEN 'satisfy_dependency'/)
  assert.match(sql, /WHEN p_signal = 'block' THEN 'raise_exception'/)
  assert.match(sql, /status = 'blocked'/)
  assert.match(sql, /status = 'completed'/)
  assert.match(sql, /BEFORE UPDATE OR DELETE ON connector_events/)
  assert.match(sql, /REVOKE ALL ON connector_events FROM anon, authenticated/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION ingest_email_connector_event/)
})

test("email connector route requires authentication and maps replay and conflicts", () => {
  const route = readFileSync(
    new URL("../app/api/connector-events/email/route.ts", import.meta.url),
    "utf8",
  )
  const server = readFileSync(
    new URL("../lib/server/connector-events.ts", import.meta.url),
    "utf8",
  )

  assert.match(route, /isRequestAuthenticated\(request\)/)
  assert.match(route, /status: 401/)
  assert.match(route, /status: result\.replayed \? 200 : 201/)
  assert.match(route, /status: 409/)
  assert.match(server, /normalizeEmailConnectorEvent\(input\)/)
  assert.match(server, /rpc\("ingest_email_connector_event"/)
  assert.match(server, /email_connector_event_idempotency_conflict/)
  assert.match(server, /case_evidence_idempotency_conflict/)
})
