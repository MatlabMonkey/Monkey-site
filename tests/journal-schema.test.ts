import assert from "node:assert/strict"
import test from "node:test"

import { JOURNAL_QUESTION_SET } from "../lib/journalSchema.ts"

test("alcohol journal input is capped at 20 drinks", () => {
  const alcoholQuestion = JOURNAL_QUESTION_SET.find((question) => question.key === "alcohol")

  assert.equal(alcoholQuestion?.metadata?.max, 20)
})
