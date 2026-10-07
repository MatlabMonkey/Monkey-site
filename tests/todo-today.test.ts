import assert from "node:assert/strict"
import test from "node:test"

import { getTodayScheduleState, selectTodayTodos } from "../lib/todoToday.ts"

const now = new Date(2026, 9, 7, 9, 0, 0)

function localIso(year: number, monthIndex: number, day: number, hour = 9) {
  return new Date(year, monthIndex, day, hour, 0, 0).toISOString()
}

test("classifies scheduled records against the local day boundary", () => {
  assert.equal(getTodayScheduleState(localIso(2026, 9, 6), now), "overdue")
  assert.equal(getTodayScheduleState(localIso(2026, 9, 7, 18), now), "today")
  assert.equal(getTodayScheduleState(localIso(2026, 9, 8), now), null)
  assert.equal(getTodayScheduleState("not-a-date", now), null)
  assert.equal(getTodayScheduleState(null, now), null)
})

test("selects incomplete overdue and today records in schedule order", () => {
  const todos = [
    { id: "future", completed: false, scheduled_for: localIso(2026, 9, 8) },
    { id: "today", completed: false, scheduled_for: localIso(2026, 9, 7, 14) },
    { id: "done", completed: true, scheduled_for: localIso(2026, 9, 6) },
    { id: "overdue", completed: false, scheduled_for: localIso(2026, 9, 5) },
    { id: "unscheduled", completed: false, scheduled_for: null },
  ]

  assert.deepEqual(
    selectTodayTodos(todos, now).map(({ todo, scheduleState }) => [todo.id, scheduleState]),
    [
      ["overdue", "overdue"],
      ["today", "today"],
    ],
  )
})
