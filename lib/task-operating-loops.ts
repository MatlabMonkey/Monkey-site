import { normalizeDateOnly, type TaskRecord, type TaskStatus } from "./tasks.ts"

export const RESTART_STALE_AFTER_DAYS = 7
export const RESTART_PREVIEW_LIMIT = 5

type RestartTask = Pick<TaskRecord, "id" | "status" | "due_on" | "updated_at">

export type RestartSummary<T extends RestartTask = TaskRecord> = {
  reference_date: string
  stale_after_days: number
  preview_limit: number
  missed_commitments: {
    count: number
    tasks: T[]
  }
  inbox_count: number
  stale_waiting: {
    count: number
    tasks: T[]
  }
  needs_cleanup: boolean
}

type RestartSummaryCounts = {
  missed_commitments?: number
  inbox?: number
  stale_waiting?: number
}

const OPEN_TASK_STATUSES = new Set<TaskStatus>(["inbox", "today", "waiting", "later"])
const DAY_IN_MS = 24 * 60 * 60 * 1000

function validTime(value: string): number | null {
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function normalizedCount(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= fallback
    ? value
    : fallback
}

export function dateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function buildRestartSummary<T extends RestartTask>(
  tasks: T[],
  referenceDate: unknown,
  now: Date = new Date(),
  counts: RestartSummaryCounts = {},
  previewLimit = RESTART_PREVIEW_LIMIT,
): RestartSummary<T> {
  const normalizedReferenceDate = normalizeDateOnly(referenceDate)
  if (!normalizedReferenceDate) throw new Error("reference_date is required")

  const safePreviewLimit = Math.max(1, Math.min(Math.trunc(previewLimit), RESTART_PREVIEW_LIMIT))
  const staleCutoff = now.getTime() - RESTART_STALE_AFTER_DAYS * DAY_IN_MS

  const missedCommitments = tasks
    .filter((task) => (
      OPEN_TASK_STATUSES.has(task.status)
      && task.due_on !== null
      && task.due_on < normalizedReferenceDate
    ))
    .sort((left, right) => (
      (left.due_on as string).localeCompare(right.due_on as string)
      || left.id.localeCompare(right.id)
    ))

  const staleWaiting = tasks
    .filter((task) => {
      if (task.status !== "waiting") return false
      const updatedTime = validTime(task.updated_at)
      return updatedTime !== null && updatedTime <= staleCutoff
    })
    .sort((left, right) => (
      (validTime(left.updated_at) as number) - (validTime(right.updated_at) as number)
      || left.id.localeCompare(right.id)
    ))

  const inboxCount = tasks.filter((task) => task.status === "inbox").length
  const missedCount = normalizedCount(counts.missed_commitments, missedCommitments.length)
  const waitingCount = normalizedCount(counts.stale_waiting, staleWaiting.length)
  const exactInboxCount = normalizedCount(counts.inbox, inboxCount)

  return {
    reference_date: normalizedReferenceDate,
    stale_after_days: RESTART_STALE_AFTER_DAYS,
    preview_limit: safePreviewLimit,
    missed_commitments: {
      count: missedCount,
      tasks: missedCommitments.slice(0, safePreviewLimit),
    },
    inbox_count: exactInboxCount,
    stale_waiting: {
      count: waitingCount,
      tasks: staleWaiting.slice(0, safePreviewLimit),
    },
    needs_cleanup: missedCount > 0 || exactInboxCount > 0 || waitingCount > 0,
  }
}
