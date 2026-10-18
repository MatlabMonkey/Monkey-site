import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { buildRestartSummary, dateInTimeZone } from "../lib/task-operating-loops.ts"
import type { TaskRecord, TaskStatus } from "../lib/tasks.ts"

const now = new Date("2026-10-18T15:00:00.000Z")

function task(
  id: string,
  status: TaskStatus,
  overrides: Partial<TaskRecord> = {},
): TaskRecord {
  return {
    id,
    title: id,
    notes: null,
    status,
    due_on: null,
    waiting_on: null,
    source: "test",
    source_id: null,
    idempotency_key: null,
    version: 1,
    created_at: "2026-10-01T12:00:00.000Z",
    updated_at: now.toISOString(),
    completed_at: null,
    ...overrides,
  }
}

test("restart mode summarizes only missed commitments, Inbox count, and stale Waiting work", () => {
  const summary = buildRestartSummary([
    task("older-missed", "later", { due_on: "2026-10-12" }),
    task("missed", "today", { due_on: "2026-10-17" }),
    task("due-today", "today", { due_on: "2026-10-18" }),
    task("finished", "done", { due_on: "2026-10-10" }),
    task("inbox", "inbox"),
    task("stale", "waiting", { updated_at: "2026-10-10T15:00:00.000Z" }),
    task("cutoff", "waiting", { updated_at: "2026-10-11T15:00:00.000Z" }),
    task("fresh", "waiting", { updated_at: "2026-10-11T15:00:01.000Z" }),
  ], "2026-10-18", now)

  assert.deepEqual(summary.missed_commitments.tasks.map((item) => item.id), ["older-missed", "missed"])
  assert.equal(summary.missed_commitments.count, 2)
  assert.equal(summary.inbox_count, 1)
  assert.deepEqual(summary.stale_waiting.tasks.map((item) => item.id), ["stale", "cutoff"])
  assert.equal(summary.stale_waiting.count, 2)
  assert.equal(summary.needs_cleanup, true)
})

test("restart previews stay bounded while preserving exact server counts", () => {
  const tasks = Array.from({ length: 8 }, (_, index) => (
    task(`missed-${index}`, "later", { due_on: `2026-10-${String(index + 1).padStart(2, "0")}` })
  ))
  const summary = buildRestartSummary(tasks, "2026-10-18", now, {
    missed_commitments: 17,
    inbox: 23,
    stale_waiting: 9,
  })

  assert.equal(summary.missed_commitments.count, 17)
  assert.equal(summary.missed_commitments.tasks.length, 5)
  assert.equal(summary.inbox_count, 23)
  assert.equal(summary.stale_waiting.count, 9)
  assert.equal(summary.preview_limit, 5)
})

test("restart reference dates honor the configured time zone", () => {
  assert.equal(dateInTimeZone(new Date("2026-10-18T06:30:00.000Z"), "America/Los_Angeles"), "2026-10-17")
  assert.equal(dateInTimeZone(new Date("2026-10-18T08:30:00.000Z"), "America/Los_Angeles"), "2026-10-18")
})

test("restart API is authenticated and the UI requires explicit entry", () => {
  const route = readFileSync(new URL("../app/api/task-restart/route.ts", import.meta.url), "utf8")
  const page = readFileSync(new URL("../app/todos/page.tsx", import.meta.url), "utf8")
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8")

  assert.match(route, /isRequestAuthenticated\(request\)/)
  assert.match(route, /status: 401/)
  assert.match(proxy, /\/api\/task-restart\/\:path\*/)
  assert.match(page, /Restart mode/)
  assert.match(page, /Back on track in 10 minutes/)
  assert.match(page, /setRestartMode\(true\)/)
})
