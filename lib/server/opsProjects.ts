import { supabase } from "../supabaseClient"
import { normalizeProjectKey } from "./opsReports"

export const PROJECT_STATUSES = ["active", "archived"] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export type OpsProjectRecord = {
  id: string
  project_key: string
  project_label: string
  description: string | null
  repo_full_name: string | null
  status: ProjectStatus
  started_at: string
  closed_at: string | null
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export class OpsProjectValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OpsProjectValidationError"
  }
}

export type ProjectScope =
  | { mode: "all"; projectKey: null }
  | { mode: "unassigned"; projectKey: null }
  | { mode: "project"; projectKey: string }

const DEFAULT_PROJECT_SEEDS: Array<{
  project_key: string
  project_label: string
  repo_full_name: string | null
  sort_order: number
}> = [
  {
    project_key: "koopman-mpc",
    project_label: "Koopman MPC",
    repo_full_name: null,
    sort_order: 10,
  },
  {
    project_key: "customer-agent-projects",
    project_label: "Customer Agent Projects",
    repo_full_name: null,
    sort_order: 20,
  },
]

function titleizeProjectKey(projectKey: string): string {
  return projectKey
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

export function normalizeProjectLabel(input: unknown, fallbackProjectKey?: string): string {
  if (typeof input === "string") {
    const trimmed = input.trim()
    if (trimmed.length > 0) return trimmed
  }

  if (fallbackProjectKey) {
    return titleizeProjectKey(fallbackProjectKey)
  }

  throw new OpsProjectValidationError("project_label is required")
}

export function normalizeProjectStatus(input: unknown): ProjectStatus {
  if (typeof input !== "string") {
    throw new OpsProjectValidationError("status must be a string")
  }

  const normalized = input.trim().toLowerCase()
  if (!PROJECT_STATUSES.includes(normalized as ProjectStatus)) {
    throw new OpsProjectValidationError("status must be one of: active, archived")
  }

  return normalized as ProjectStatus
}

export function normalizeRepoFullName(input: unknown): string | null {
  if (input === null || input === undefined) return null
  if (typeof input !== "string") {
    throw new OpsProjectValidationError("repo_full_name must be a string")
  }

  let normalized = input.trim().toLowerCase()
  if (!normalized) return null

  normalized = normalized
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/^git@github\.com:/, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "")

  if (!normalized) return null

  const pieces = normalized.split("/").filter(Boolean)
  if (pieces.length === 1) {
    return pieces[0]
  }

  if (pieces.length >= 2) {
    return `${pieces[0]}/${pieces[1]}`
  }

  return normalized
}

function normalizeMetadata(input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) return {}
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new OpsProjectValidationError("metadata must be an object")
  }
  return input as Record<string, unknown>
}

export function parseProjectScope(raw: string | null): ProjectScope {
  if (!raw) return { mode: "all", projectKey: null }

  const normalized = raw.trim().toLowerCase()
  if (!normalized || normalized === "all") {
    return { mode: "all", projectKey: null }
  }

  if (normalized === "unassigned") {
    return { mode: "unassigned", projectKey: null }
  }

  return {
    mode: "project",
    projectKey: normalizeProjectKey(normalized),
  }
}

function repoBaseName(repo: string | null): string | null {
  if (!repo) return null
  const pieces = repo.split("/").filter(Boolean)
  if (pieces.length === 0) return null
  return pieces[pieces.length - 1] || null
}

export function inferProjectKeyFromRepo(
  repoLike: string | null | undefined,
  projects: Array<Pick<OpsProjectRecord, "project_key" | "repo_full_name">>,
): string | null {
  const normalizedRepo = normalizeRepoFullName(repoLike ?? null)
  if (!normalizedRepo) return null

  const normalizedBaseName = repoBaseName(normalizedRepo)

  // 1) Exact repo_full_name match.
  for (const project of projects) {
    const projectRepo = normalizeRepoFullName(project.repo_full_name)
    if (projectRepo && projectRepo === normalizedRepo) {
      return project.project_key
    }
  }

  // 2) Match explicit project key against full repo or repo basename.
  for (const project of projects) {
    if (project.project_key === normalizedRepo || project.project_key === normalizedBaseName) {
      return project.project_key
    }
  }

  // 3) Match repo basename against configured project repo basename.
  for (const project of projects) {
    const projectRepoBase = repoBaseName(normalizeRepoFullName(project.repo_full_name))
    if (projectRepoBase && projectRepoBase === normalizedBaseName) {
      return project.project_key
    }
  }

  return null
}

export function resolveProjectKeyForEntity(
  explicitProjectKey: string | null | undefined,
  repoLike: string | null | undefined,
  projects: Array<Pick<OpsProjectRecord, "project_key" | "repo_full_name">>,
): string | null {
  if (explicitProjectKey && explicitProjectKey.trim()) {
    return normalizeProjectKey(explicitProjectKey)
  }

  return inferProjectKeyFromRepo(repoLike, projects)
}

export async function ensureProjectExists(
  projectKey: string,
  projectLabel?: string | null,
  options?: {
    repoFullName?: string | null
  },
) {
  const normalizedKey = normalizeProjectKey(projectKey)
  const normalizedLabel = normalizeProjectLabel(projectLabel, normalizedKey)

  const payload = {
    project_key: normalizedKey,
    project_label: normalizedLabel,
    repo_full_name: normalizeRepoFullName(options?.repoFullName ?? null),
  }

  const { error } = await supabase.from("ops_projects").upsert(payload, { onConflict: "project_key", ignoreDuplicates: true })
  if (error) throw error
}

async function seedDefaultProjects() {
  const { error } = await supabase
    .from("ops_projects")
    .upsert(
      DEFAULT_PROJECT_SEEDS.map((seed) => ({
        project_key: seed.project_key,
        project_label: seed.project_label,
        repo_full_name: seed.repo_full_name,
        sort_order: seed.sort_order,
      })),
      { onConflict: "project_key", ignoreDuplicates: true },
    )

  if (error) throw error
}

async function backfillProjectsFromReports() {
  const { data, error } = await supabase
    .from("work_reports")
    .select("project_key, project_label")
    .order("published_at", { ascending: false })
    .limit(500)

  if (error) throw error

  if (!data || data.length === 0) return

  const map = new Map<string, { project_key: string; project_label: string }>()

  for (const report of data) {
    if (!report.project_key) continue

    const projectKey = normalizeProjectKey(report.project_key)
    if (map.has(projectKey)) continue

    map.set(projectKey, {
      project_key: projectKey,
      project_label: normalizeProjectLabel(report.project_label, projectKey),
    })
  }

  if (map.size === 0) return

  const { error: upsertError } = await supabase
    .from("ops_projects")
    .upsert(Array.from(map.values()), { onConflict: "project_key", ignoreDuplicates: true })

  if (upsertError) throw upsertError
}

export async function ensureOpsProjectCatalog() {
  await seedDefaultProjects()
  await backfillProjectsFromReports()
}

export async function getProjects() {
  await ensureOpsProjectCatalog()

  const { data, error } = await supabase
    .from("ops_projects")
    .select("*")
    .order("status", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false })

  if (error) throw error

  return (data || []) as OpsProjectRecord[]
}

export function normalizeProjectPatchInput(input: Record<string, unknown>) {
  const updates: Record<string, unknown> = {}

  if ("project_key" in input) {
    if (input.project_key === null) {
      throw new OpsProjectValidationError("project_key cannot be null")
    }

    if (typeof input.project_key !== "string") {
      throw new OpsProjectValidationError("project_key must be a string")
    }

    updates.project_key = normalizeProjectKey(input.project_key)
  }

  if ("project_label" in input) {
    updates.project_label = normalizeProjectLabel(input.project_label, typeof updates.project_key === "string" ? updates.project_key : undefined)
  }

  if ("description" in input) {
    if (input.description === null || input.description === undefined) {
      updates.description = null
    } else if (typeof input.description === "string") {
      updates.description = input.description.trim() || null
    } else {
      throw new OpsProjectValidationError("description must be a string")
    }
  }

  if ("repo_full_name" in input) {
    updates.repo_full_name = normalizeRepoFullName(input.repo_full_name)
  }

  if ("status" in input) {
    const status = normalizeProjectStatus(input.status)
    updates.status = status
    updates.closed_at = status === "archived" ? new Date().toISOString() : null
  }

  if ("sort_order" in input) {
    if (typeof input.sort_order !== "number" || !Number.isFinite(input.sort_order)) {
      throw new OpsProjectValidationError("sort_order must be a number")
    }
    updates.sort_order = Math.trunc(input.sort_order)
  }

  if ("metadata" in input) {
    updates.metadata = normalizeMetadata(input.metadata)
  }

  if (Object.keys(updates).length === 0) {
    throw new OpsProjectValidationError("No valid project fields provided")
  }

  updates.updated_at = new Date().toISOString()

  return updates
}

export function normalizeProjectCreateInput(input: Record<string, unknown>) {
  const keySource = typeof input.project_key === "string" && input.project_key.trim()
    ? input.project_key
    : typeof input.project_label === "string"
      ? input.project_label
      : null

  if (!keySource) {
    throw new OpsProjectValidationError("project_key or project_label is required")
  }

  const projectKey = normalizeProjectKey(keySource)

  const payload = {
    project_key: projectKey,
    project_label: normalizeProjectLabel(input.project_label, projectKey),
    description:
      typeof input.description === "string"
        ? input.description.trim() || null
        : input.description === null || input.description === undefined
          ? null
          : (() => {
              throw new OpsProjectValidationError("description must be a string")
            })(),
    repo_full_name: normalizeRepoFullName(input.repo_full_name),
    status: "active" as ProjectStatus,
    started_at:
      typeof input.started_at === "string" && input.started_at.trim()
        ? (() => {
            const parsed = new Date(input.started_at)
            if (Number.isNaN(parsed.getTime())) {
              throw new OpsProjectValidationError("started_at must be a valid datetime")
            }
            return parsed.toISOString()
          })()
        : new Date().toISOString(),
    sort_order:
      typeof input.sort_order === "number" && Number.isFinite(input.sort_order)
        ? Math.trunc(input.sort_order)
        : 0,
    metadata: normalizeMetadata(input.metadata),
  }

  return payload
}

export function matchesProjectScope(
  resolvedProjectKey: string | null,
  scope: ProjectScope,
): boolean {
  if (scope.mode === "all") return true
  if (scope.mode === "unassigned") return !resolvedProjectKey
  return resolvedProjectKey === scope.projectKey
}
