import assert from "node:assert/strict"
import test from "node:test"

import { normalizeJournalNumericInput } from "../lib/journalNumericInput.ts"

test("0-10 input replaces an accidental first digit while preserving ten", () => {
  assert.equal(normalizeJournalNumericInput("56", 10), 6)
  assert.equal(normalizeJournalNumericInput("27", 10), 7)
  assert.equal(normalizeJournalNumericInput("10", 10), 10)
})

test("numeric input still supports clearing and decimal ratings", () => {
  assert.equal(normalizeJournalNumericInput("", 10), null)
  assert.equal(normalizeJournalNumericInput("5.5", 10), 5.5)
})
