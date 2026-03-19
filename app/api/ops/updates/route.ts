import { NextRequest, NextResponse } from "next/server"
import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { supabase } from "../../../../lib/supabaseClient"
import {
  OpsProjectValidationError,
  ensureProjectExists,
  getProjects,
  resolveProjectKeyForEntity,
} from "../../../../lib/server/opsProjects"

const VALID_STATUSES = ["in_progress", "needs_review", "blocked", "shipped"] as const
const execFileAsync = promisify(execFile)

type CreateUpdateBody = {
  summary?: string
  repo?: string
  branch?: string
  commit_start?: string
  commit_end?: string
  commit_url?: string
  pr_url?: string
  files_touched?: string[]
  why_it_matters?: string
  status?: string
  project_key?: string | null
}

type InferredProvenance = {
  repo: string | null
  branch: string | null
  commitStart: string | null
  commitEnd: string | null
  commitUrl: string | null
  filesTouched: string[]
}

function shortSha(value: string | null) {
  return value ? value.slice(0, 7) : null
}

async function inferLocalGitProvenance(explicitRepo?: string): Promise<InferredProvenance> {
  const fallbackRepo = process.env.OPS_GITHUB_REPO?.trim() || null
  const repo = explicitRepo?.trim() || fallbackRepo

  const cwd = process.cwd()
  const gitDir = path.join(cwd, ".git")
  if (!existsSync(gitDir)) {
    return {
      repo,
      branch: null,
      commitStart: null,
      commitEnd: null,
      commitUrl: null,
      filesTouched: [],
    }
  }

  try {
    const branchRes = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd })
    const headRes = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })
    const prevRes = await execFileAsync("git", ["rev-parse", "HEAD~1"], { cwd }).catch(() => ({ stdout: "" }))

    const branch = branchRes.stdout.trim() || null
    const commitEnd = headRes.stdout.trim() || null
    const commitStart = prevRes.stdout.trim() || null

    let filesTouched: string[] = []
    if (commitStart && commitEnd) {
      const filesRes = await execFileAsync("git", ["diff", "--name-only", commitStart, commitEnd], { cwd }).catch(() => ({ stdout: "" }))
      filesTouched = filesRes.stdout
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 10)
    }

    const commitUrl = repo && commitEnd ? `https://github.com/${repo}/commit/${commitEnd}` : null

    return {
      repo,
      branch,
      commitStart: shortSha(commitStart),
      commitEnd: shortSha(commitEnd),
      commitUrl,
      filesTouched,
    }
  } catch {
    return {
      repo,
      branch: null,
      commitStart: null,
      commitEnd: null,
      commitUrl: null,
      filesTouched: [],
    }
  }
}

function normalizeProjectKeyInput(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") {
    throw new OpsProjectValidationError("project_key must be a string")
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === "unassigned") return null

  return resolveProjectKeyForEntity(trimmed, null, [])
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateUpdateBody

    if (!body.summary?.trim()) {
      return NextResponse.json({ error: "summary is required" }, { status: 400 })
    }

    const status = body.status || "in_progress"
    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 })
    }

    const inferred = await inferLocalGitProvenance(body.repo)
    const resolvedRepo = body.repo?.trim() || inferred.repo || "local/unspecified"

    const filesTouched = Array.isArray(body.files_touched)
      ? body.files_touched.map((item) => item.trim()).filter(Boolean).slice(0, 10)
      : inferred.filesTouched

    const commitStart = body.commit_start?.trim() || inferred.commitStart || null
    const commitEnd = body.commit_end?.trim() || inferred.commitEnd || null

    const projects = await getProjects()
    const explicitProjectKey = normalizeProjectKeyInput(body.project_key)
    const resolvedProjectKey = explicitProjectKey ?? resolveProjectKeyForEntity(null, resolvedRepo, projects)

    if (resolvedProjectKey) {
      await ensureProjectExists(resolvedProjectKey)
    }

    const { data, error } = await supabase
      .from("work_updates")
      .insert({
        summary: body.summary.trim(),
        repo: resolvedRepo,
        branch: body.branch?.trim() || inferred.branch || "main",
        project_key: resolvedProjectKey,
        commit_start: commitStart,
        commit_end: commitEnd,
        commit_url: body.commit_url?.trim() || inferred.commitUrl || null,
        pr_url: body.pr_url?.trim() || null,
        files_touched: filesTouched,
        why_it_matters: body.why_it_matters?.trim() || null,
        status,
        checkpoint_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json({ update: data }, { status: 201 })
  } catch (error) {
    if (error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to create work update", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
