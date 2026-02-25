export const TODO_BUCKETS = [
  "inbox",
  "next_action",
  "project",
  "waiting_for",
  "calendar",
  "someday_maybe",
  "reference",
  "trash",
] as const

export type TodoBucket = (typeof TODO_BUCKETS)[number]

export const TODO_CONTEXTS = ["personal", "work"] as const
export type TodoContext = (typeof TODO_CONTEXTS)[number]

export const TODO_ITEM_TYPES = ["task", "project"] as const
export type TodoItemType = (typeof TODO_ITEM_TYPES)[number]

export const TODO_OUTCOMES = [
  "do_now",
  "next_action",
  "project",
  "waiting_for",
  "calendar",
  "someday_maybe",
  "reference",
  "trash",
] as const
export type TodoOutcome = (typeof TODO_OUTCOMES)[number]

export function isTodoBucket(value: unknown): value is TodoBucket {
  return typeof value === "string" && TODO_BUCKETS.includes(value as TodoBucket)
}

export function isTodoContext(value: unknown): value is TodoContext {
  return typeof value === "string" && TODO_CONTEXTS.includes(value as TodoContext)
}

export function isTodoItemType(value: unknown): value is TodoItemType {
  return typeof value === "string" && TODO_ITEM_TYPES.includes(value as TodoItemType)
}

export function isTodoOutcome(value: unknown): value is TodoOutcome {
  return typeof value === "string" && TODO_OUTCOMES.includes(value as TodoOutcome)
}

export function normalizeTodoContext(value: unknown): TodoContext | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== "string") return undefined

  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined
  if (normalized === "inbox") return "personal"

  return isTodoContext(normalized) ? normalized : undefined
}
