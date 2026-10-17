import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  normalizeOrganizationProposal,
  organizationBoundaryFor,
} from "../lib/task-organization.ts"
import { TaskValidationError } from "../lib/tasks.ts"

const baseInput = {
  task_id: "task-123",
  task_version: 2,
  changes: { status: "today" },
  confidence: 0.94,
  rationale: "  Clear   action for today. ",
  rule_id: "inbox.clear-next-action.v1",
}

test("organization proposals normalize to deterministic structured output", () => {
  const first = normalizeOrganizationProposal(baseInput)
  const second = normalizeOrganizationProposal(structuredClone(baseInput))

  assert.deepEqual(first, second)
  assert.equal(first.rationale, "Clear action for today.")
  assert.equal(first.boundary, "auto_apply")
})

test("only high-confidence, non-destructive status routing can auto-apply", () => {
  assert.equal(organizationBoundaryFor({ status: "today" }, 0.9), "auto_apply")
  assert.equal(organizationBoundaryFor({ status: "later" }, 1), "auto_apply")
  assert.equal(organizationBoundaryFor({ status: "today" }, 0.899), "needs_review")
  assert.equal(organizationBoundaryFor({ status: "done" }, 1), "needs_review")
  assert.equal(organizationBoundaryFor({ status: "archived" }, 1), "needs_review")
  assert.equal(organizationBoundaryFor({ due_on: "2026-10-20" }, 1), "needs_review")
  assert.equal(organizationBoundaryFor({ status: "waiting", waiting_on: "Sam" }, 1), "needs_review")
})

test("proposal validation rejects ambiguous or unsupported output", () => {
  assert.throws(
    () => normalizeOrganizationProposal({ ...baseInput, changes: {} }),
    TaskValidationError,
  )
  assert.throws(
    () => normalizeOrganizationProposal({ ...baseInput, confidence: 1.01 }),
    /confidence/,
  )
  assert.throws(
    () => normalizeOrganizationProposal({ ...baseInput, changes: { priority: "urgent" } }),
    /Unsupported organization field/,
  )
})

test("organization persistence keeps proposal rationale and review history immutable", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/029_task_organization_proposals.sql", import.meta.url),
    "utf8",
  )

  assert.match(sql, /CREATE TABLE task_organization_proposals/)
  assert.match(sql, /CREATE TABLE task_organization_events/)
  assert.match(sql, /proposal inputs and rationale are immutable/)
  assert.match(sql, /BEFORE UPDATE OR DELETE ON task_organization_events/)
  assert.match(sql, /state IN \('pending', 'applied', 'rejected', 'superseded'\)/)
  assert.match(sql, /changes->>'status' IN \('today', 'later'\)/)
  assert.match(sql, /REVOKE ALL ON task_organization_proposals FROM anon, authenticated/)
})
