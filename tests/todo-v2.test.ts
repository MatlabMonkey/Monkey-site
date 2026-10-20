import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  normalizeDateOnly,
  normalizeOptionalText,
  normalizeShortcutCapture,
  normalizeTaskStatus,
  normalizeTaskTitle,
  TASK_STATUSES,
  TaskValidationError,
  taskViewStatuses,
} from "../lib/tasks.ts"

test("capture accepts messy text but produces a compact title", () => {
  assert.equal(normalizeTaskTitle("  book   dentist\nappointment  "), "book dentist appointment")
  assert.throws(() => normalizeTaskTitle("   "), TaskValidationError)
  assert.throws(() => normalizeTaskTitle("x".repeat(501)), /500 characters/)
})

test("Shortcut capture requires a stable ID and derives replay-safe identity", () => {
  assert.deepEqual(
    normalizeShortcutCapture({
      content: "  call   the dentist  ",
      capture_id: "8E744D54-2E09-47A1-B793-28A8D2C4D357",
    }),
    {
      title: "call the dentist",
      source: "shortcut",
      source_id: "8E744D54-2E09-47A1-B793-28A8D2C4D357",
      idempotency_key: "shortcut:8E744D54-2E09-47A1-B793-28A8D2C4D357",
    },
  )
  assert.throws(() => normalizeShortcutCapture({ title: "Call dentist" }), /capture_id/)
  assert.throws(
    () => normalizeShortcutCapture({ title: "Call dentist", capture_id: "not safe / value" }),
    /capture_id/,
  )
})

test("optional metadata stays optional and dates are strict", () => {
  assert.equal(normalizeOptionalText("   ", "notes"), null)
  assert.equal(normalizeOptionalText(undefined, "notes"), undefined)
  assert.equal(normalizeDateOnly("2026-10-16"), "2026-10-16")
  assert.throws(() => normalizeDateOnly("2026-02-30"), /real calendar date/)
})

test("the execution views map directly to canonical states", () => {
  assert.deepEqual(taskViewStatuses("today"), ["today"])
  assert.deepEqual(taskViewStatuses("inbox"), ["inbox"])
  assert.deepEqual(taskViewStatuses("done"), ["done", "archived"])
  assert.equal(normalizeTaskStatus(undefined, "inbox"), "inbox")
  assert.throws(() => normalizeTaskStatus("next_action"), /Invalid task status/)
})

test("migration creates a fresh model and makes history immutable", () => {
  const sql = readFileSync(new URL("../supabase/migrations/028_task_system_v2.sql", import.meta.url), "utf8")
  assert.match(sql, /CREATE TABLE tasks \(/)
  assert.match(sql, /CREATE TABLE task_events \(/)
  assert.match(sql, /Legacy `todos` data is intentionally not migrated/)
  assert.match(sql, /BEFORE UPDATE OR DELETE ON task_events/)
  assert.match(sql, /AFTER INSERT OR UPDATE ON tasks/)
  for (const status of TASK_STATUSES) assert.match(sql, new RegExp(`'${status}'`))
  assert.doesNotMatch(sql, /INSERT INTO tasks[\s\S]+FROM todos/i)
})

test("v2 server routes require an authenticated PIN session", () => {
  const routeFiles = [
    "../app/api/tasks/route.ts",
    "../app/api/tasks/[id]/route.ts",
    "../app/api/task-events/route.ts",
  ]

  for (const routeFile of routeFiles) {
    const source = readFileSync(new URL(routeFile, import.meta.url), "utf8")
    assert.match(source, /isRequestAuthenticated\(request\)/)
    assert.match(source, /status: 401/)
  }
})

test("Shortcut capture uses bearer auth and explicit replay outcomes", () => {
  const route = readFileSync(new URL("../app/api/tasks/capture/route.ts", import.meta.url), "utf8")
  const service = readFileSync(new URL("../lib/server/tasks.ts", import.meta.url), "utf8")

  assert.match(route, /CAPTURE_API_KEY/)
  assert.match(route, /timingSafeEqual/)
  assert.match(route, /result\.replayed \? 200 : 201/)
  assert.match(route, /status: 409/)
  assert.match(service, /error\.code !== "23505"/)
  assert.match(service, /\.from\("task_events"\)/)
  assert.match(service, /captureEvent\.after_state/)
  assert.match(service, /Capture ID was already used with different task content/)
})
