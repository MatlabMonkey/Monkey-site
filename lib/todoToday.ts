export type TodayScheduleState = "overdue" | "today"

type SchedulableTodo = {
  completed: boolean
  scheduled_for: string | null
}

export type TodayTodo<T> = {
  todo: T
  scheduleState: TodayScheduleState
}

export function getTodayScheduleState(
  scheduledFor: string | null,
  now: Date = new Date(),
): TodayScheduleState | null {
  if (!scheduledFor) return null

  const scheduledAt = new Date(scheduledFor)
  if (Number.isNaN(scheduledAt.getTime())) return null

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

  if (scheduledAt < startOfToday) return "overdue"
  if (scheduledAt < startOfTomorrow) return "today"
  return null
}

export function selectTodayTodos<T extends SchedulableTodo>(
  todos: T[],
  now: Date = new Date(),
): Array<TodayTodo<T>> {
  return todos
    .flatMap((todo) => {
      if (todo.completed) return []

      const scheduleState = getTodayScheduleState(todo.scheduled_for, now)
      return scheduleState ? [{ todo, scheduleState }] : []
    })
    .sort((left, right) => {
      return new Date(left.todo.scheduled_for as string).getTime() - new Date(right.todo.scheduled_for as string).getTime()
    })
}
