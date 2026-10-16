import assert from "node:assert/strict"
import test from "node:test"

import { buildRestartSummary } from "../lib/todoRestart.ts"

const now = new Date(2026, 9, 16, 9, 0, 0)

function todo(
  id: string,
  overrides: Partial<{ completed: boolean; scheduled_for: string | null; updated_at: string }> = {},
) {
  return {
    id,
    completed: false,
    scheduled_for: null,
    updated_at: now.toISOString(),
    ...overrides,
  }
}

test("summarizes only missed commitments, inbox count, and stale waiting items", () => {
  const scheduled = [
    todo("oldest-missed", { scheduled_for: new Date(2026, 9, 13, 9).toISOString() }),
    todo("missed", { scheduled_for: new Date(2026, 9, 15, 18).toISOString() }),
    todo("today", { scheduled_for: new Date(2026, 9, 16, 8).toISOString() }),
    todo("done", { completed: true, scheduled_for: new Date(2026, 9, 14, 9).toISOString() }),
    todo("invalid-schedule", { scheduled_for: "not-a-date" }),
  ]
  const inbox = [todo("captured"), todo("captured-done", { completed: true })]
  const waiting = [
    todo("stalest", { updated_at: new Date(2026, 9, 1, 9).toISOString() }),
    todo("stale", { updated_at: new Date(2026, 9, 9, 9).toISOString() }),
    todo("fresh", { updated_at: new Date(2026, 9, 10, 10).toISOString() }),
    todo("invalid-update", { updated_at: "not-a-date" }),
  ]

  const summary = buildRestartSummary(scheduled, inbox, waiting, now)

  assert.deepEqual(summary.missedCommitments.map((item) => item.id), ["oldest-missed", "missed"])
  assert.equal(summary.inboxCount, 1)
  assert.deepEqual(summary.staleWaiting.map((item) => item.id), ["stalest", "stale"])
  assert.equal(summary.needsCleanup, true)
})

test("reports a clear restart when no recovery work remains", () => {
  const summary = buildRestartSummary(
    [todo("today", { scheduled_for: new Date(2026, 9, 16, 11).toISOString() })],
    [],
    [todo("fresh")],
    now,
  )

  assert.equal(summary.needsCleanup, false)
  assert.deepEqual(summary.missedCommitments, [])
  assert.equal(summary.inboxCount, 0)
  assert.deepEqual(summary.staleWaiting, [])
})
