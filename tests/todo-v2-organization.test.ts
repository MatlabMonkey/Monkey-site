import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  normalizeOrganizationProposal,
  normalizeOrganizationReview,
  organizationBoundaryFor,
} from "../lib/task-organization.ts"
import { TaskValidationError } from "../lib/tasks.ts"

const baseInput = {
  task_id: "123e4567-e89b-42d3-a456-426614174000",
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
  assert.throws(
    () => normalizeOrganizationProposal({ ...baseInput, task_id: "task-123" }),
    /UUID/,
  )
})

test("review commands normalize to one explicit terminal state with rationale", () => {
  assert.deepEqual(
    normalizeOrganizationReview({ action: "apply", reviewer: "user", reason: "  Looks right. " }),
    { state: "applied", reviewer: "user", reason: "Looks right." },
  )
  assert.equal(
    normalizeOrganizationReview({ action: "reject", reviewer: "user", reason: "Wrong date" }).state,
    "rejected",
  )
  assert.throws(
    () => normalizeOrganizationReview({ action: "edit", reviewer: "user", reason: "No" }),
    /apply, reject, or supersede/,
  )
  assert.throws(
    () => normalizeOrganizationReview({ action: "apply", reviewer: "user", reason: "  " }),
    /rationale is required/,
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
  assert.match(sql, /CREATE OR REPLACE FUNCTION review_task_organization_proposal/)
  assert.match(sql, /current_task_version <> proposal\.task_version/)
  assert.match(sql, /proposal\.boundary = 'auto_apply' AND current_task_status <> 'inbox'/)
  assert.match(sql, /'outcome', 'stale'/)
  assert.match(sql, /set_config\('app\.task_actor', p_reviewer, true\)/)
  assert.match(sql, /REVOKE ALL ON task_organization_proposals FROM anon, authenticated/)
  assert.match(sql, /REVOKE ALL ON FUNCTION review_task_organization_proposal/)
})

test("organization server routes require authentication and expose conflicts", () => {
  const routeFiles = [
    "../app/api/task-organization-proposals/route.ts",
    "../app/api/task-organization-proposals/[id]/route.ts",
  ]

  for (const routeFile of routeFiles) {
    const source = readFileSync(new URL(routeFile, import.meta.url), "utf8")
    assert.match(source, /isRequestAuthenticated\(request\)/)
    assert.match(source, /status: 401/)
  }

  const createRoute = readFileSync(new URL(routeFiles[0], import.meta.url), "utf8")
  const reviewRoute = readFileSync(new URL(routeFiles[1], import.meta.url), "utf8")
  assert.match(createRoute, /createOrganizationProposal/)
  assert.match(reviewRoute, /reviewOrganizationProposal/)
  assert.match(reviewRoute, /status: 409/)
})

test("organization review UI shows task context and requires review rationale", () => {
  const serverSource = readFileSync(
    new URL("../lib/server/task-organization.ts", import.meta.url),
    "utf8",
  )
  const pageSource = readFileSync(new URL("../app/todos/page.tsx", import.meta.url), "utf8")

  assert.match(serverSource, /task:tasks\(id, title, status, version, due_on, waiting_on\)/)
  assert.match(pageSource, /Organization review/)
  assert.match(pageSource, /\/api\/task-organization-proposals\?state=pending/)
  assert.match(pageSource, /Why are you applying or rejecting this suggestion\?/)
  assert.match(pageSource, /Boolean\(taskChanged\)/)
  assert.match(pageSource, /onReview\(proposal, "apply", reason\)/)
  assert.match(pageSource, /onReview\(proposal, "reject", reason\)/)
})
