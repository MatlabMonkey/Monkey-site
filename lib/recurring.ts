const WEEKDAY_TOKENS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

type WeeklyToken = (typeof WEEKDAY_TOKENS)[number]

type DailyRule = { kind: "daily" }
type WeeklyRule = { kind: "weekly"; days: number[] }
type MonthlyRule = { kind: "monthly"; day: number }

export type ParsedRecurringRule = DailyRule | WeeklyRule | MonthlyRule

export class RecurringValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RecurringValidationError"
  }
}

function formatDateOnly(date: Date): string {
  return date.toISOString().split("T")[0]
}

function toUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
}

function daysInMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

function parseDateOnly(value: string, fieldName: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new RecurringValidationError(`${fieldName} must be in YYYY-MM-DD format`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RecurringValidationError(`${fieldName} must be a valid calendar date`)
  }

  return date
}

function tokenToWeekday(token: string): number {
  return WEEKDAY_TOKENS.indexOf(token as WeeklyToken)
}

function weekdayToToken(weekday: number): WeeklyToken {
  const token = WEEKDAY_TOKENS[weekday]
  if (!token) {
    throw new RecurringValidationError("Invalid weekday value")
  }
  return token
}

function parseWeeklyDays(raw: string): number[] {
  const tokens = raw.split(",").map((part) => part.trim().toLowerCase())
  if (tokens.length === 0 || tokens.some((token) => !token)) {
    throw new RecurringValidationError("weekly rrule must include at least one weekday")
  }

  const unique = new Set<number>()
  for (const token of tokens) {
    const weekday = tokenToWeekday(token)
    if (weekday === -1) {
      throw new RecurringValidationError(`Invalid weekday: ${token}`)
    }
    unique.add(weekday)
  }

  return [...unique].sort((a, b) => a - b)
}

function normalizeFromDate(fromDate: Date | string): Date {
  if (typeof fromDate === "string") {
    return parseDateOnly(fromDate, "fromDate")
  }

  if (!(fromDate instanceof Date) || Number.isNaN(fromDate.getTime())) {
    throw new RecurringValidationError("fromDate must be a valid date")
  }

  return toUtcDay(fromDate)
}

function nextWeeklyDate(anchor: Date, days: number[], inclusive: boolean): Date {
  const daySet = new Set(days)
  const currentDay = anchor.getUTCDay()
  const startOffset = inclusive ? 0 : 1

  for (let offset = startOffset; offset <= 7; offset += 1) {
    const candidateDay = (currentDay + offset) % 7
    if (daySet.has(candidateDay)) {
      return addUtcDays(anchor, offset)
    }
  }

  return addUtcDays(anchor, 7)
}

function nextMonthlyDate(anchor: Date, dayOfMonth: number, inclusive: boolean): Date {
  const year = anchor.getUTCFullYear()
  const month = anchor.getUTCMonth()
  const maxThisMonth = daysInMonthUtc(year, month)
  const thisMonthDate = new Date(Date.UTC(year, month, Math.min(dayOfMonth, maxThisMonth)))

  if ((inclusive && thisMonthDate.getTime() >= anchor.getTime()) || (!inclusive && thisMonthDate.getTime() > anchor.getTime())) {
    return thisMonthDate
  }

  const nextMonthAnchor = new Date(Date.UTC(year, month + 1, 1))
  const nextYear = nextMonthAnchor.getUTCFullYear()
  const nextMonth = nextMonthAnchor.getUTCMonth()
  const maxNextMonth = daysInMonthUtc(nextYear, nextMonth)
  return new Date(Date.UTC(nextYear, nextMonth, Math.min(dayOfMonth, maxNextMonth)))
}

export function parseRecurringRRule(input: unknown): ParsedRecurringRule {
  if (typeof input !== "string") {
    throw new RecurringValidationError("rrule is required")
  }

  const value = input.trim().toLowerCase()
  if (!value) {
    throw new RecurringValidationError("rrule is required")
  }

  if (value === "daily") {
    return { kind: "daily" }
  }

  if (value.startsWith("weekly:")) {
    const rawDays = value.slice("weekly:".length)
    const days = parseWeeklyDays(rawDays)
    return { kind: "weekly", days }
  }

  if (value.startsWith("monthly:")) {
    const rawDay = value.slice("monthly:".length).trim()
    if (!/^\d{1,2}$/.test(rawDay)) {
      throw new RecurringValidationError("monthly rrule must be monthly:<day> where day is 1-31")
    }

    const day = Number(rawDay)
    if (day < 1 || day > 31) {
      throw new RecurringValidationError("monthly rrule day must be between 1 and 31")
    }

    return { kind: "monthly", day }
  }

  throw new RecurringValidationError("Unsupported rrule. Use daily, weekly:<days>, or monthly:<day>")
}

export function normalizeRecurringRRule(input: unknown): string {
  const parsed = parseRecurringRRule(input)

  if (parsed.kind === "daily") {
    return "daily"
  }

  if (parsed.kind === "weekly") {
    const days = parsed.days.map((day) => weekdayToToken(day)).join(",")
    return `weekly:${days}`
  }

  return `monthly:${parsed.day}`
}

export function getNextRecurringRunDate(
  rrule: string,
  options: { fromDate?: Date | string; inclusive?: boolean } = {},
): string {
  const parsed = parseRecurringRRule(rrule)
  const fromDate = options.fromDate ?? new Date()
  const inclusive = options.inclusive ?? true
  const anchor = normalizeFromDate(fromDate)

  if (parsed.kind === "daily") {
    return formatDateOnly(inclusive ? anchor : addUtcDays(anchor, 1))
  }

  if (parsed.kind === "weekly") {
    return formatDateOnly(nextWeeklyDate(anchor, parsed.days, inclusive))
  }

  return formatDateOnly(nextMonthlyDate(anchor, parsed.day, inclusive))
}

export function advanceRecurringRunDate(rrule: string, currentRunAt: string): string {
  return getNextRecurringRunDate(rrule, { fromDate: currentRunAt, inclusive: false })
}

export function describeRecurringRRule(rrule: string): string {
  const parsed = parseRecurringRRule(rrule)

  if (parsed.kind === "daily") {
    return "Every day"
  }

  if (parsed.kind === "weekly") {
    const labels = parsed.days
      .map((day) => weekdayToToken(day))
      .map((token) => token.slice(0, 1).toUpperCase() + token.slice(1))
      .join(", ")
    return `Every week on ${labels}`
  }

  return `Day ${parsed.day} of every month`
}
