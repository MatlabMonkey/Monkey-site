export const DEFAULT_SLUG_MAX_LENGTH = 160

function normalizeDashSeparated(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function normalizeSlugValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return null

  const normalized = normalizeDashSeparated(value)
  if (!normalized) return null

  return normalized.slice(0, DEFAULT_SLUG_MAX_LENGTH)
}

export function formatSlugDate(dateLike: Date | string | number | null | undefined): string {
  const parsed = dateLike ? new Date(dateLike) : new Date()
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }

  return parsed.toISOString().slice(0, 10)
}

function shortenTitleSegment(title: string, maxLength: number): string {
  const normalized = normalizeDashSeparated(title)
  if (!normalized) return "update"

  const parts = normalized.split("-").filter(Boolean).slice(0, 8)
  const compact = parts.join("-") || normalized

  if (compact.length <= maxLength) return compact

  return compact.slice(0, maxLength).replace(/-+$/g, "") || "update"
}

export function buildProjectDateTitleSlug(input: {
  projectKey: string
  date?: Date | string | number | null
  title: string
  maxLength?: number
}) {
  const maxLength = Math.max(40, input.maxLength ?? DEFAULT_SLUG_MAX_LENGTH)

  const projectKey = normalizeDashSeparated(input.projectKey) || "project"
  const datePart = formatSlugDate(input.date)

  const reserved = projectKey.length + datePart.length + 2
  const availableForTitle = Math.max(8, maxLength - reserved)
  const titlePart = shortenTitleSegment(input.title, availableForTitle)

  const rawSlug = `${projectKey}-${datePart}-${titlePart}`
  if (rawSlug.length <= maxLength) return rawSlug

  const clampedTitle = shortenTitleSegment(titlePart, Math.max(8, availableForTitle - 6))
  return `${projectKey}-${datePart}-${clampedTitle}`.slice(0, maxLength).replace(/-+$/g, "")
}

export type SlugExistsFn = (candidate: string) => Promise<boolean>

function withSuffix(baseSlug: string, suffixNumber: number, maxLength: number): string {
  const suffix = `-${suffixNumber}`
  const trimmedBase = baseSlug.slice(0, Math.max(1, maxLength - suffix.length)).replace(/-+$/g, "")
  return `${trimmedBase}${suffix}`
}

export async function ensureUniqueSlug(
  baseSlug: string,
  exists: SlugExistsFn,
  options?: {
    maxAttempts?: number
    maxLength?: number
  },
): Promise<string> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 200)
  const maxLength = Math.max(40, options?.maxLength ?? DEFAULT_SLUG_MAX_LENGTH)
  const normalizedBase = normalizeDashSeparated(baseSlug || "item") || "item"

  for (let index = 0; index < maxAttempts; index += 1) {
    const candidate =
      index === 0
        ? normalizedBase.slice(0, maxLength)
        : withSuffix(normalizedBase, index + 1, maxLength)

    const taken = await exists(candidate)
    if (!taken) return candidate
  }

  throw new Error("Unable to allocate a unique slug")
}
