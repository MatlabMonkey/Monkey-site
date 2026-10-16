type RestartTodo = {
  completed: boolean
  scheduled_for: string | null
  updated_at: string
}

export type RestartSummary<T> = {
  missedCommitments: T[]
  inboxCount: number
  staleWaiting: T[]
  needsCleanup: boolean
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

function validTime(value: string | null): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

export function buildRestartSummary<T extends RestartTodo>(
  scheduledTodos: T[],
  inboxTodos: T[],
  waitingTodos: T[],
  now: Date = new Date(),
  staleAfterDays = 7,
): RestartSummary<T> {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const staleCutoff = now.getTime() - staleAfterDays * DAY_IN_MS

  const missedCommitments = scheduledTodos
    .filter((todo) => {
      if (todo.completed) return false
      const scheduledTime = validTime(todo.scheduled_for)
      return scheduledTime !== null && scheduledTime < startOfToday.getTime()
    })
    .sort((left, right) => {
      return (validTime(left.scheduled_for) as number) - (validTime(right.scheduled_for) as number)
    })

  const staleWaiting = waitingTodos
    .filter((todo) => {
      if (todo.completed) return false
      const updatedTime = validTime(todo.updated_at)
      return updatedTime !== null && updatedTime <= staleCutoff
    })
    .sort((left, right) => {
      return (validTime(left.updated_at) as number) - (validTime(right.updated_at) as number)
    })

  const inboxCount = inboxTodos.filter((todo) => !todo.completed).length

  return {
    missedCommitments,
    inboxCount,
    staleWaiting,
    needsCleanup: missedCommitments.length > 0 || inboxCount > 0 || staleWaiting.length > 0,
  }
}
