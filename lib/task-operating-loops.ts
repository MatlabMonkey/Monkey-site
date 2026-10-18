import { normalizeDateOnly, type TaskRecord, type TaskStatus } from "./tasks.ts"

export const RESTART_STALE_AFTER_DAYS = 7
export const RESTART_PREVIEW_LIMIT = 5
export const DAILY_REVIEW_PREVIEW_LIMIT = 5
export const WEEKLY_REVIEW_STALE_AFTER_DAYS = 14
export const WEEKLY_REVIEW_PREVIEW_LIMIT = 5

type RestartTask = Pick<TaskRecord, "id" | "status" | "due_on" | "updated_at">
type DailyReviewTask = Pick<TaskRecord, "id" | "status" | "due_on" | "created_at">
type WeeklyReviewTask = Pick<TaskRecord, "id" | "status" | "created_at" | "updated_at">

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

export type DailyReviewSummary<T extends DailyReviewTask = TaskRecord> = {
  reference_date: string
  preview_limit: number
  due_outside_today: {
    count: number
    tasks: T[]
  }
  today: {
    count: number
    tasks: T[]
  }
  inbox_count: number
  needs_review: boolean
}

type DailyReviewSummaryCounts = {
  due_outside_today?: number
  today?: number
  inbox?: number
}

export type WeeklyReviewSummary<T extends WeeklyReviewTask = TaskRecord> = {
  reference_date: string
  stale_after_days: number
  preview_limit: number
  inbox: {
    count: number
    tasks: T[]
  }
  waiting: {
    count: number
    tasks: T[]
  }
  stale_work: {
    count: number
    tasks: T[]
  }
  needs_review: boolean
}

type WeeklyReviewSummaryCounts = {
  inbox?: number
  waiting?: number
  stale_work?: number
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

export function buildDailyReviewSummary<T extends DailyReviewTask>(
  tasks: T[],
  referenceDate: unknown,
  counts: DailyReviewSummaryCounts = {},
  previewLimit = DAILY_REVIEW_PREVIEW_LIMIT,
): DailyReviewSummary<T> {
  const normalizedReferenceDate = normalizeDateOnly(referenceDate)
  if (!normalizedReferenceDate) throw new Error("reference_date is required")

  const safePreviewLimit = Math.max(1, Math.min(Math.trunc(previewLimit), DAILY_REVIEW_PREVIEW_LIMIT))
  const dueOutsideToday = tasks
    .filter((task) => (
      task.status !== "today"
      && OPEN_TASK_STATUSES.has(task.status)
      && task.due_on !== null
      && task.due_on <= normalizedReferenceDate
    ))
    .sort((left, right) => (
      (left.due_on as string).localeCompare(right.due_on as string)
      || left.created_at.localeCompare(right.created_at)
      || left.id.localeCompare(right.id)
    ))
  const today = tasks
    .filter((task) => task.status === "today")
    .sort((left, right) => (
      (left.due_on || "9999-12-31").localeCompare(right.due_on || "9999-12-31")
      || left.created_at.localeCompare(right.created_at)
      || left.id.localeCompare(right.id)
    ))
  const inboxCount = tasks.filter((task) => task.status === "inbox").length
  const dueCount = normalizedCount(counts.due_outside_today, dueOutsideToday.length)
  const todayCount = normalizedCount(counts.today, today.length)
  const exactInboxCount = normalizedCount(counts.inbox, inboxCount)

  return {
    reference_date: normalizedReferenceDate,
    preview_limit: safePreviewLimit,
    due_outside_today: {
      count: dueCount,
      tasks: dueOutsideToday.slice(0, safePreviewLimit),
    },
    today: {
      count: todayCount,
      tasks: today.slice(0, safePreviewLimit),
    },
    inbox_count: exactInboxCount,
    needs_review: dueCount > 0 || todayCount > 0 || exactInboxCount > 0,
  }
}

export function buildWeeklyReviewSummary<T extends WeeklyReviewTask>(
  tasks: T[],
  referenceDate: unknown,
  now: Date = new Date(),
  counts: WeeklyReviewSummaryCounts = {},
  previewLimit = WEEKLY_REVIEW_PREVIEW_LIMIT,
): WeeklyReviewSummary<T> {
  const normalizedReferenceDate = normalizeDateOnly(referenceDate)
  if (!normalizedReferenceDate) throw new Error("reference_date is required")

  const safePreviewLimit = Math.max(1, Math.min(Math.trunc(previewLimit), WEEKLY_REVIEW_PREVIEW_LIMIT))
  const staleCutoff = now.getTime() - WEEKLY_REVIEW_STALE_AFTER_DAYS * DAY_IN_MS
  const oldestFirst = (left: T, right: T) => (
    (validTime(left.updated_at) ?? Number.MAX_SAFE_INTEGER) - (validTime(right.updated_at) ?? Number.MAX_SAFE_INTEGER)
    || left.created_at.localeCompare(right.created_at)
    || left.id.localeCompare(right.id)
  )
  const inbox = tasks
    .filter((task) => task.status === "inbox")
    .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id))
  const waiting = tasks
    .filter((task) => task.status === "waiting")
    .sort(oldestFirst)
  const staleWork = tasks
    .filter((task) => {
      if (task.status !== "today" && task.status !== "later") return false
      const updatedTime = validTime(task.updated_at)
      return updatedTime !== null && updatedTime <= staleCutoff
    })
    .sort(oldestFirst)
  const inboxCount = normalizedCount(counts.inbox, inbox.length)
  const waitingCount = normalizedCount(counts.waiting, waiting.length)
  const staleWorkCount = normalizedCount(counts.stale_work, staleWork.length)

  return {
    reference_date: normalizedReferenceDate,
    stale_after_days: WEEKLY_REVIEW_STALE_AFTER_DAYS,
    preview_limit: safePreviewLimit,
    inbox: {
      count: inboxCount,
      tasks: inbox.slice(0, safePreviewLimit),
    },
    waiting: {
      count: waitingCount,
      tasks: waiting.slice(0, safePreviewLimit),
    },
    stale_work: {
      count: staleWorkCount,
      tasks: staleWork.slice(0, safePreviewLimit),
    },
    needs_review: inboxCount > 0 || waitingCount > 0 || staleWorkCount > 0,
  }
}
