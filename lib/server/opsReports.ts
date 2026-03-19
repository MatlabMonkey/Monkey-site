const REPORT_TYPES = ["html", "md", "pdf", "link"] as const

const FIELD_LIMITS = {
  project_key: 80,
  project_label: 120,
  title: 180,
  summary: 2000,
  report_url: 2000,
  artifact_path: 500,
  commit_ref: 120,
  published_by: 120,
  tags: 20,
  tag_length: 40,
} as const

export type ReportType = (typeof REPORT_TYPES)[number]

export type WorkReportRecord = {
  id: string
  project_key: string
  project_label: string
  title: string
  summary: string
  report_type: ReportType
  report_url: string
  artifact_path: string | null
  commit_ref: string | null
  tags: string[]
  published_by: string
  published_at: string
  created_at: string
  updated_at: string
}

export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReportValidationError"
  }
}

function normalizeTextField(field: keyof typeof FIELD_LIMITS, value: unknown): string {
  if (typeof value !== "string") {
    throw new ReportValidationError(`${field} must be a string`)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new ReportValidationError(`${field} is required`)
  }

  if (trimmed.length > FIELD_LIMITS[field]) {
    throw new ReportValidationError(`${field} is too long (max ${FIELD_LIMITS[field]} chars)`)
  }

  return trimmed
}

function normalizeOptionalTextField(field: "artifact_path" | "commit_ref" | "published_by", value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") {
    throw new ReportValidationError(`${field} must be a string`)
  }

  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.length > FIELD_LIMITS[field]) {
    throw new ReportValidationError(`${field} is too long (max ${FIELD_LIMITS[field]} chars)`)
  }

  return trimmed
}

export function normalizeProjectKey(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (!normalized) {
    throw new ReportValidationError("project_key is required")
  }

  if (normalized.length > FIELD_LIMITS.project_key) {
    throw new ReportValidationError(`project_key is too long (max ${FIELD_LIMITS.project_key} chars)`)
  }

  return normalized
}

function normalizeReportType(value: unknown): ReportType {
  if (typeof value !== "string") {
    throw new ReportValidationError("report_type must be a string")
  }

  const normalized = value.trim().toLowerCase()
  if (!REPORT_TYPES.includes(normalized as ReportType)) {
    throw new ReportValidationError(`report_type must be one of: ${REPORT_TYPES.join(", ")}`)
  }

  return normalized as ReportType
}

function normalizeReportUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new ReportValidationError("report_url must be a string")
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new ReportValidationError("report_url is required")
  }

  if (trimmed.length > FIELD_LIMITS.report_url) {
    throw new ReportValidationError(`report_url is too long (max ${FIELD_LIMITS.report_url} chars)`)
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ReportValidationError("report_url must be an http(s) URL")
    }
    return parsed.toString()
  } catch {
    throw new ReportValidationError("report_url must be a valid URL")
  }
}

function normalizeTags(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    throw new ReportValidationError("tags must be an array of strings")
  }

  const tags = new Set<string>()

  for (const item of value) {
    if (typeof item !== "string") continue
    const normalized = item.trim().toLowerCase()
    if (!normalized) continue

    if (normalized.length > FIELD_LIMITS.tag_length) {
      throw new ReportValidationError(`tag is too long (max ${FIELD_LIMITS.tag_length} chars)`)
    }

    tags.add(normalized)
    if (tags.size > FIELD_LIMITS.tags) {
      throw new ReportValidationError(`tags can contain at most ${FIELD_LIMITS.tags} entries`)
    }
  }

  return Array.from(tags)
}

function normalizePublishedAt(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined

  if (typeof value !== "string") {
    throw new ReportValidationError("published_at must be a datetime string")
  }

  const trimmed = value.trim()
  if (!trimmed) return undefined

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new ReportValidationError("published_at must be a valid datetime")
  }

  return parsed.toISOString()
}

type NormalizeOptions = {
  partial?: boolean
}

export function normalizeReportInput(input: Record<string, unknown>, options: NormalizeOptions = {}) {
  const { partial = false } = options
  const payload: Record<string, unknown> = {}

  if (!partial || "project_key" in input) {
    if (typeof input.project_key !== "string") {
      throw new ReportValidationError("project_key is required")
    }
    payload.project_key = normalizeProjectKey(input.project_key)
  }

  if (!partial || "project_label" in input) {
    payload.project_label = normalizeTextField("project_label", input.project_label)
  }

  if (!partial || "title" in input) {
    payload.title = normalizeTextField("title", input.title)
  }

  if (!partial || "summary" in input) {
    payload.summary = normalizeTextField("summary", input.summary)
  }

  if (!partial || "report_type" in input) {
    payload.report_type = normalizeReportType(input.report_type)
  }

  if (!partial || "report_url" in input) {
    payload.report_url = normalizeReportUrl(input.report_url)
  }

  if (!partial || "artifact_path" in input) {
    payload.artifact_path = normalizeOptionalTextField("artifact_path", input.artifact_path)
  }

  if (!partial || "commit_ref" in input) {
    payload.commit_ref = normalizeOptionalTextField("commit_ref", input.commit_ref)
  }

  if (!partial || "published_by" in input) {
    payload.published_by = normalizeOptionalTextField("published_by", input.published_by) || "agent"
  }

  if (!partial || "tags" in input) {
    payload.tags = normalizeTags(input.tags)
  }

  if (!partial || "published_at" in input) {
    const publishedAt = normalizePublishedAt(input.published_at)
    if (publishedAt) {
      payload.published_at = publishedAt
    }
  }

  if (partial && Object.keys(payload).length === 0) {
    throw new ReportValidationError("No valid report fields provided")
  }

  return payload
}

export function parseProjectFilter(raw: string | null): string | null {
  if (!raw) return null
  return normalizeProjectKey(raw)
}

export { REPORT_TYPES }
