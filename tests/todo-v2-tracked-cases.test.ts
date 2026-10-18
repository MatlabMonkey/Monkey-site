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
  normalizeCaseDependency,
  normalizeCaseDependencyResolution,
  normalizeTrackedCase,
  normalizeTrackedCaseTask,
  normalizeTrackedCaseTaskRemoval,
  normalizeTrackedCaseUpdate,
  normalizeTrackedCaseUuid,
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

test("tracked-case lifecycle updates require a reason and optimistic version", () => {
  const input = {
    expected_version: 3,
    reason: "  External confirmation   arrived. ",
    status: "completed",
    automation_state: "finished",
    ...completeDeadline,
  }

  assert.deepEqual(normalizeTrackedCaseUpdate(input), normalizeTrackedCaseUpdate(structuredClone(input)))
  assert.deepEqual(normalizeTrackedCaseUpdate(input), {
    expected_version: 3,
    reason: "External confirmation arrived.",
    changes: {
      status: "completed",
      automation_state: "finished",
      deadline_on: "2026-11-01",
      deadline_provenance_type: "external",
      deadline_provenance_ref: "email:message-42",
      deadline_confidence: 0.96,
    },
  })

  assert.deepEqual(normalizeTrackedCaseUpdate({
    expected_version: 4,
    reason: "Deadline no longer applies",
    deadline_on: null,
    deadline_provenance_type: null,
    deadline_provenance_ref: null,
    deadline_confidence: null,
  }).changes, {
    deadline_on: null,
    deadline_provenance_type: null,
    deadline_provenance_ref: null,
    deadline_confidence: null,
  })
})

test("tracked-case lifecycle validation rejects ambiguous or stale-prone commands", () => {
  assert.equal(
    normalizeTrackedCaseUuid("123E4567-E89B-42D3-A456-426614174000"),
    "123e4567-e89b-42d3-a456-426614174000",
  )
  assert.throws(() => normalizeTrackedCaseUuid("case-1"), /UUID/)
  assert.throws(
    () => normalizeTrackedCaseUpdate({ expected_version: 0, reason: "No", status: "blocked" }),
    /positive integer/,
  )
  assert.throws(
    () => normalizeTrackedCaseUpdate({ expected_version: 1, reason: " ", status: "blocked" }),
    /reason is required/,
  )
  assert.throws(
    () => normalizeTrackedCaseUpdate({ expected_version: 1, reason: "Change", status: "waiting" }),
    /status must be one of/,
  )
  assert.throws(
    () => normalizeTrackedCaseUpdate({
      expected_version: 1,
      reason: "Change deadline",
      deadline_on: "2026-11-02",
    }),
    /all deadline fields/,
  )
  assert.throws(
    () => normalizeTrackedCaseUpdate({ expected_version: 1, reason: "Nothing" }),
    /No tracked case changes/,
  )
})

test("tracked-case task and dependency commands normalize deterministically", () => {
  const firstTaskId = "123e4567-e89b-42d3-a456-426614174000"
  const secondTaskId = "223e4567-e89b-42d3-a456-426614174000"

  assert.deepEqual(normalizeTrackedCaseTask({
    task_id: firstTaskId.toUpperCase(),
    role: "next_action",
    reason: "  This is the next   concrete action. ",
  }), {
    task_id: firstTaskId,
    role: "next_action",
    reason: "This is the next concrete action.",
  })
  assert.deepEqual(normalizeTrackedCaseTaskRemoval({
    task_id: firstTaskId,
    reason: " No longer part of this outcome. ",
  }), {
    task_id: firstTaskId,
    reason: "No longer part of this outcome.",
  })
  assert.deepEqual(normalizeCaseDependency({
    blocked_task_id: secondTaskId,
    blocking_task_id: firstTaskId,
    rationale: "  Appointment must happen first. ",
  }), {
    blocked_task_id: secondTaskId,
    blocking_task_id: firstTaskId,
    rationale: "Appointment must happen first.",
  })
  assert.deepEqual(normalizeCaseDependencyResolution({
    state: "waived",
    reason: " Requirement was removed. ",
  }), {
    state: "waived",
    reason: "Requirement was removed.",
  })
})

test("tracked-case task and dependency commands reject unsafe ambiguity", () => {
  const taskId = "123e4567-e89b-42d3-a456-426614174000"

  assert.throws(
    () => normalizeTrackedCaseTask({ task_id: "task-1", role: "next_action", reason: "Attach" }),
    /task_id must be a UUID/,
  )
  assert.throws(
    () => normalizeTrackedCaseTask({ task_id: taskId, role: "optional", reason: "Attach" }),
    /role must be one of/,
  )
  assert.throws(
    () => normalizeCaseDependency({
      blocked_task_id: taskId,
      blocking_task_id: taskId,
      rationale: "Circular",
    }),
    /cannot depend on itself/,
  )
  assert.throws(
    () => normalizeCaseDependencyResolution({ state: "open", reason: "Undo" }),
    /state must be one of/,
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
  assert.match(sql, /CREATE OR REPLACE FUNCTION create_tracked_case/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION update_tracked_case/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION set_tracked_case_task/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION remove_tracked_case_task/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION create_case_dependency/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION resolve_case_dependency/)
  assert.match(sql, /current_case\.version <> p_expected_version/)
  assert.match(sql, /set_config\('app\.case_actor', p_actor, true\)/)
  assert.match(sql, /set_config\('app\.case_reason', btrim\(p_reason\), true\)/)
  assert.match(sql, /case_task_has_dependencies/)
  assert.match(sql, /case_dependency_already_resolved/)
  assert.match(sql, /FOR UPDATE/)
  assert.match(sql, /REVOKE ALL ON FUNCTION create_tracked_case/)
  assert.match(sql, /REVOKE ALL ON FUNCTION update_tracked_case/)
})

test("tracked-case lifecycle routes require authentication and expose version conflicts", () => {
  const collectionRoute = readFileSync(
    new URL("../app/api/tracked-cases/route.ts", import.meta.url),
    "utf8",
  )
  const detailRoute = readFileSync(
    new URL("../app/api/tracked-cases/[id]/route.ts", import.meta.url),
    "utf8",
  )
  const serverSource = readFileSync(
    new URL("../lib/server/tracked-cases.ts", import.meta.url),
    "utf8",
  )
  const taskRoute = readFileSync(
    new URL("../app/api/tracked-cases/[id]/tasks/route.ts", import.meta.url),
    "utf8",
  )
  const dependencyRoute = readFileSync(
    new URL("../app/api/tracked-cases/[id]/dependencies/route.ts", import.meta.url),
    "utf8",
  )
  const dependencyDetailRoute = readFileSync(
    new URL("../app/api/tracked-cases/[id]/dependencies/[dependencyId]/route.ts", import.meta.url),
    "utf8",
  )

  for (const source of [
    collectionRoute,
    detailRoute,
    taskRoute,
    dependencyRoute,
    dependencyDetailRoute,
  ]) {
    assert.match(source, /isRequestAuthenticated\(request\)/)
    assert.match(source, /status: 401/)
  }
  assert.match(collectionRoute, /createTrackedCase/)
  assert.match(detailRoute, /updateTrackedCase/)
  assert.match(detailRoute, /getTrackedCase/)
  assert.match(detailRoute, /status: 409/)
  assert.match(serverSource, /rpc\("create_tracked_case"/)
  assert.match(serverSource, /rpc\("update_tracked_case"/)
  assert.match(serverSource, /rpc\("set_tracked_case_task"/)
  assert.match(serverSource, /rpc\("remove_tracked_case_task"/)
  assert.match(serverSource, /rpc\("create_case_dependency"/)
  assert.match(serverSource, /rpc\("resolve_case_dependency"/)
  assert.match(serverSource, /from\("tracked_case_tasks"\)/)
  assert.match(serverSource, /from\("case_dependencies"\)/)
  assert.match(serverSource, /from\("case_events"\)/)
})
