import { supabase } from "../supabaseClient"
import { resolveProjectKeyForEntity } from "./opsProjects"
import { buildProjectDateTitleSlug, ensureUniqueSlug, normalizeSlugValue } from "./slugStrategy"

export const RUN_STATUSES = ["draft", "published"] as const
export const RUN_TRIGGER_SOURCES = ["auto_policy", "manual", "subagent", "push"] as const

export type RunStatus = (typeof RUN_STATUSES)[number]
export type RunTriggerSource = (typeof RUN_TRIGGER_SOURCES)[number]

const FIELD_LIMITS = {
  project_key: 80,
  title: 180,
  summary: 4000,
  trigger_reasons: 30,
  trigger_reason_len: 240,
  commit_refs: 20,
  commit_ref_len: 200,
  next_steps: 20,
  next_step_len: 240,
  deep_report_url: 2000,
  deep_report_slug: 160,
  slug: 160,
} as const

export class OpsRunValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OpsRunValidationError"
  }
}

function normalizeRequiredText(field: "title" | "summary", value: unknown): string {
  if (typeof value !== "string") {
    throw new OpsRunValidationError(`${field} must be a string`)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new OpsRunValidationError(`${field} is required`)
  }

  if (trimmed.length > FIELD_LIMITS[field]) {
    throw new OpsRunValidationError(`${field} is too long (max ${FIELD_LIMITS[field]} chars)`)
  }

  return trimmed
}

function normalizeOptionalText(value: unknown, field: "deep_report_url"): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") {
    throw new OpsRunValidationError(`${field} must be a string`)
  }

  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > FIELD_LIMITS[field]) {
    throw new OpsRunValidationError(`${field} is too long (max ${FIELD_LIMITS[field]} chars)`)
  }

  if (trimmed.startsWith("/")) return trimmed

  try {
    const parsed = new URL(trimmed)
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new OpsRunValidationError(`${field} must be an http(s) URL or internal path`)
    }
    return parsed.toString()
  } catch {
    throw new OpsRunValidationError(`${field} must be a valid URL or internal path`)
  }
}

function normalizeStringArray(input: unknown, field: "trigger_reasons" | "commit_refs" | "next_steps"): string[] {
  if (input === null || input === undefined) return []
  if (!Array.isArray(input)) {
    throw new OpsRunValidationError(`${field} must be an array of strings`)
  }

  const maxItems = FIELD_LIMITS[field]
  const maxLength =
    field === "trigger_reasons"
      ? FIELD_LIMITS.trigger_reason_len
      : field === "commit_refs"
        ? FIELD_LIMITS.commit_ref_len
        : FIELD_LIMITS.next_step_len

  const values: string[] = []

  for (const item of input) {
    if (typeof item !== "string") continue
    const trimmed = item.trim()
    if (!trimmed) continue
    if (trimmed.length > maxLength) {
      throw new OpsRunValidationError(`${field} item is too long (max ${maxLength} chars)`)
    }

    values.push(trimmed)
    if (values.length > maxItems) {
      throw new OpsRunValidationError(`${field} can contain at most ${maxItems} entries`)
    }
  }

  return values
}

function normalizeStatus(value: unknown): RunStatus {
  if (typeof value !== "string") {
    throw new OpsRunValidationError("status must be a string")
  }

  const normalized = value.trim().toLowerCase()
  if (!RUN_STATUSES.includes(normalized as RunStatus)) {
    throw new OpsRunValidationError(`status must be one of: ${RUN_STATUSES.join(", ")}`)
  }

  return normalized as RunStatus
}

function normalizeTriggerSource(value: unknown): RunTriggerSource {
  if (typeof value !== "string") {
    throw new OpsRunValidationError("trigger_source must be a string")
  }

  const normalized = value.trim().toLowerCase()
  if (!RUN_TRIGGER_SOURCES.includes(normalized as RunTriggerSource)) {
    throw new OpsRunValidationError(`trigger_source must be one of: ${RUN_TRIGGER_SOURCES.join(", ")}`)
  }

  return normalized as RunTriggerSource
}

function normalizeConfidence(value: unknown): number {
  if (value === undefined || value === null) return 0
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new OpsRunValidationError("trigger_confidence must be a number")
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeRunDate(value: unknown): string {
  if (value === undefined || value === null) return new Date().toISOString()
  if (typeof value !== "string") {
    throw new OpsRunValidationError("run_date must be a datetime string")
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new OpsRunValidationError("run_date must be a valid datetime")
  }

  return parsed.toISOString()
}

function normalizeJsonObject(value: unknown, field: "checks_json" | "metrics_json" | "artifacts_json") {
  if (value === undefined || value === null) return {}
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new OpsRunValidationError(`${field} must be a JSON object`)
  }

  return value as Record<string, unknown>
}

function normalizeOptionalUuid(value: unknown, field: "deep_report_id" | "source_update_id"): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") {
    throw new OpsRunValidationError(`${field} must be a UUID string`)
  }

  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(trimmed)) {
    throw new OpsRunValidationError(`${field} must be a valid UUID`)
  }

  return trimmed
}

export function normalizeRunInput(input: Record<string, unknown>, options?: { partial?: boolean }) {
  const partial = Boolean(options?.partial)
  const payload: Record<string, unknown> = {}

  if (!partial || "project_key" in input) {
    if (typeof input.project_key !== "string") {
      throw new OpsRunValidationError("project_key is required")
    }

    const resolved = resolveProjectKeyForEntity(input.project_key, null, [])
    if (!resolved || resolved.length > FIELD_LIMITS.project_key) {
      throw new OpsRunValidationError("project_key is invalid")
    }

    payload.project_key = resolved
  }

  if (!partial || "title" in input) {
    payload.title = normalizeRequiredText("title", input.title)
  }

  if (!partial || "summary" in input) {
    payload.summary = normalizeRequiredText("summary", input.summary)
  }

  if (!partial || "status" in input) {
    payload.status = normalizeStatus(input.status ?? "draft")
  }

  if (!partial || "trigger_source" in input) {
    payload.trigger_source = normalizeTriggerSource(input.trigger_source ?? "manual")
  }

  if (!partial || "trigger_confidence" in input) {
    payload.trigger_confidence = normalizeConfidence(input.trigger_confidence)
  }

  if (!partial || "trigger_reasons" in input) {
    payload.trigger_reasons = normalizeStringArray(input.trigger_reasons, "trigger_reasons")
  }

  if (!partial || "run_date" in input) {
    payload.run_date = normalizeRunDate(input.run_date)
  }

  if (!partial || "commit_refs" in input) {
    payload.commit_refs = normalizeStringArray(input.commit_refs, "commit_refs")
  }

  if (!partial || "checks_json" in input) {
    payload.checks_json = normalizeJsonObject(input.checks_json, "checks_json")
  }

  if (!partial || "metrics_json" in input) {
    payload.metrics_json = normalizeJsonObject(input.metrics_json, "metrics_json")
  }

  if (!partial || "artifacts_json" in input) {
    payload.artifacts_json = normalizeJsonObject(input.artifacts_json, "artifacts_json")
  }

  if (!partial || "next_steps" in input) {
    payload.next_steps = normalizeStringArray(input.next_steps, "next_steps")
  }

  if (!partial || "deep_report_id" in input) {
    payload.deep_report_id = normalizeOptionalUuid(input.deep_report_id, "deep_report_id")
  }

  if (!partial || "source_update_id" in input) {
    payload.source_update_id = normalizeOptionalUuid(input.source_update_id, "source_update_id")
  }

  if (!partial || "deep_report_url" in input) {
    payload.deep_report_url = normalizeOptionalText(input.deep_report_url, "deep_report_url")
  }

  if (!partial || "deep_report_slug" in input) {
    const normalizedSlug = normalizeSlugValue(input.deep_report_slug)
    payload.deep_report_slug = normalizedSlug
      ? normalizedSlug.slice(0, FIELD_LIMITS.deep_report_slug)
      : null
  }

  if (!partial || "slug" in input) {
    const normalizedSlug = normalizeSlugValue(input.slug)
    payload.slug = normalizedSlug ? normalizedSlug.slice(0, FIELD_LIMITS.slug) : null
  }

  if (partial && Object.keys(payload).length === 0) {
    throw new OpsRunValidationError("No valid run fields provided")
  }

  return payload
}

export async function findOpsRunBySlug(slug: string) {
  const { data, error } = await supabase.from("ops_runs").select("id").eq("slug", slug).maybeSingle()
  if (error) throw error
  return data
}

export async function generateUniqueRunSlug(input: {
  projectKey: string
  title: string
  date?: string | Date | null
  excludeRunId?: string
}) {
  const baseSlug = buildProjectDateTitleSlug({
    projectKey: input.projectKey,
    title: input.title,
    date: input.date,
  })

  return ensureUniqueSlug(baseSlug, async (candidate) => {
    let query = supabase.from("ops_runs").select("id").eq("slug", candidate)
    if (input.excludeRunId) {
      query = query.neq("id", input.excludeRunId)
    }

    const { data, error } = await query.maybeSingle()
    if (error) throw error
    return Boolean(data)
  })
}

export function buildRunDeepReportLink(run: {
  deep_report_slug?: string | null
  deep_report_url?: string | null
  deep_report?: {
    slug?: string | null
    report_url?: string | null
  } | null
}) {
  const joinedSlug = run.deep_report?.slug || run.deep_report_slug
  if (joinedSlug) return `/reports/${joinedSlug}`

  if (run.deep_report?.report_url) return run.deep_report.report_url
  if (run.deep_report_url) return run.deep_report_url

  return null
}
