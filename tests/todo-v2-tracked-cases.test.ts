import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  CASE_AUTOMATION_STATES,
  CASE_DEPENDENCY_STATES,
  CASE_ESCALATION_SEVERITIES,
  CASE_ESCALATION_STATES,
  CASE_EVIDENCE_TYPES,
  CASE_STATUSES,
  CASE_TASK_ROLES,
  DEADLINE_PROVENANCE_TYPES,
  normalizeTrackedCase,
} from "../lib/tracked-cases.ts"
import { TaskValidationError } from "../lib/tasks.ts"

const completeDeadline = {
  deadline_on: "2026-11-01",
  deadline_provenance_type: "external",
  deadline_provenance_ref: " email:message-42 ",
  deadline_confidence: 0.96,
}

test("tracked cases normalize outcome and explicit deadline provenance deterministically", () => {
  const input = {
    title: "  Renew   passport ",
    outcome: " Passport renewed before travel. ",
    ...completeDeadline,
  }

  assert.deepEqual(normalizeTrackedCase(input), normalizeTrackedCase(structuredClone(input)))
  assert.deepEqual(normalizeTrackedCase(input), {
    title: "Renew passport",
    outcome: "Passport renewed before travel.",
    deadline_on: "2026-11-01",
    deadline_provenance_type: "external",
    deadline_provenance_ref: "email:message-42",
    deadline_confidence: 0.96,
  })
})

test("tracked cases permit no deadline or a complete provenance bundle, never a partial one", () => {
  assert.deepEqual(
    normalizeTrackedCase({ title: "Find a dentist", outcome: "A first appointment is booked." }),
    {
      title: "Find a dentist",
      outcome: "A first appointment is booked.",
      deadline_on: null,
      deadline_provenance_type: null,
      deadline_provenance_ref: null,
      deadline_confidence: null,
    },
  )
  assert.throws(
    () => normalizeTrackedCase({ title: "Renew passport", outcome: "Renewed", deadline_on: "2026-11-01" }),
    /must be supplied together/,
  )
  assert.throws(
    () => normalizeTrackedCase({
      title: "Renew passport",
      outcome: "Renewed",
      ...completeDeadline,
      deadline_confidence: 1.01,
    }),
    /0 to 1/,
  )
  assert.throws(
    () => normalizeTrackedCase({ title: "Renew passport", outcome: "  " }),
    TaskValidationError,
  )
})

test("tracked-case migration models reviewable outcomes, dependencies, evidence, automation, and escalation", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/030_tracked_cases.sql", import.meta.url),
    "utf8",
  )

  for (const table of [
    "tracked_cases",
    "tracked_case_tasks",
    "case_dependencies",
    "case_evidence",
    "case_escalations",
    "case_events",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table}`))
    assert.match(sql, new RegExp(`REVOKE ALL ON ${table} FROM anon, authenticated`))
  }

  for (const value of [
    ...CASE_STATUSES,
    ...CASE_AUTOMATION_STATES,
    ...DEADLINE_PROVENANCE_TYPES,
    ...CASE_TASK_ROLES,
    ...CASE_DEPENDENCY_STATES,
    ...CASE_EVIDENCE_TYPES,
    ...CASE_ESCALATION_SEVERITIES,
    ...CASE_ESCALATION_STATES,
  ]) {
    assert.match(sql, new RegExp(`'${value}'`))
  }

  assert.match(sql, /deadline_provenance_type/)
  assert.match(sql, /deadline_confidence NUMERIC\(4, 3\)/)
  assert.match(sql, /FOREIGN KEY \(case_id, blocked_task_id\)/)
  assert.match(sql, /FOREIGN KEY \(dependency_id, case_id\)/)
  assert.match(sql, /UNIQUE \(source, source_id\)/)
  assert.match(sql, /Evidence is metadata-only and append-only/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION record_case_event\(\)/)
  assert.match(sql, /AFTER INSERT OR UPDATE ON case_escalations/)
  assert.match(sql, /BEFORE UPDATE OR DELETE ON case_evidence/)
  assert.match(sql, /BEFORE UPDATE OR DELETE ON case_events/)
})
