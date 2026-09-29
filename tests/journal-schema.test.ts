import assert from "node:assert/strict"
import test from "node:test"

import { JOURNAL_QUESTION_SET } from "../lib/journalSchema.ts"

test("alcohol journal input is capped at 20 drinks", () => {
  const alcoholQuestion = JOURNAL_QUESTION_SET.find((question) => question.key === "alcohol")

  assert.equal(alcoholQuestion?.metadata?.max, 20)
})

test("stress journal input is labeled by its high-end value", () => {
  const stressQuestion = JOURNAL_QUESTION_SET.find((question) => question.key === "stress_calm")

  assert.equal(stressQuestion?.wording, "Stress")
  assert.equal(stressQuestion?.metadata?.min, 0)
  assert.equal(stressQuestion?.metadata?.max, 10)
})
