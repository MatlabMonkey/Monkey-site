import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { normalizeTodoCaptureIdentity, TodoValidationError } from "../lib/todoCaptureIdentity.ts"

test("capture identity defaults to the canonical app source", () => {
  assert.deepEqual(normalizeTodoCaptureIdentity({}), {
    source: "app",
    source_id: null,
    idempotency_key: null,
  })
})

test("capture identity trims supplied provenance fields", () => {
  assert.deepEqual(
    normalizeTodoCaptureIdentity({
      source: " shortcut ",
      source_id: " message-42 ",
      idempotency_key: " request-42 ",
    }),
    {
      source: "shortcut",
      source_id: "message-42",
      idempotency_key: "request-42",
    },
  )
})

test("capture identity rejects invalid values", () => {
  assert.throws(() => normalizeTodoCaptureIdentity({ source: " " }), TodoValidationError)
  assert.throws(() => normalizeTodoCaptureIdentity({ source_id: 42 }), TodoValidationError)
  assert.throws(
    () => normalizeTodoCaptureIdentity({ idempotency_key: "x".repeat(256) }),
    TodoValidationError,
  )
})

test("V1 migration extends canonical todos without deferred pipeline tables", () => {
  const migration = readFileSync("supabase/migrations/027_todo_provenance_and_events.sql", "utf8")

  assert.match(migration, /ALTER TABLE todos[\s\S]*ADD COLUMN IF NOT EXISTS source TEXT/)
  assert.match(migration, /UNIQUE \(context, source, source_id\)/)
  assert.match(migration, /UNIQUE \(context, source, idempotency_key\)/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS todo_events/)
  assert.match(migration, /AFTER INSERT OR UPDATE OR DELETE ON todos/)
  assert.match(migration, /BEFORE UPDATE OR DELETE ON todo_events/)

  for (const deferredTable of [
    "todo_captures",
    "todo_assistant_jobs",
    "todo_external_sources",
    "todo_routing_rules",
  ]) {
    assert.doesNotMatch(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${deferredTable}`))
  }
})
