import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../../lib/supabaseClient"
import {
  evaluateUpdateAsRunLogCandidate,
  REPORT_POLICY_ELIGIBLE_STATUSES,
} from "../../../../../lib/server/reportPolicy"
import { buildProjectDateTitleSlug } from "../../../../../lib/server/slugStrategy"

const DEFAULT_LIMIT = 80
const MAX_LIMIT = 250

function isMissingRelationError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "42P01")
}

function parseLimit(raw: string | null) {
  const parsed = raw ? Number(raw) : DEFAULT_LIMIT
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsed)))
}

function normalizeFilesTouched(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function buildDraftTitle(summary: string) {
  const trimmed = summary.trim()
  if (!trimmed) return "Run log draft"

  return `Run log: ${trimmed}`.slice(0, 180)
}

function shouldFilterByProject(projectKey: string | null): projectKey is string {
  return typeof projectKey === "string" && projectKey.trim().length > 0
}

export async function GET(request: NextRequest) {
  try {
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"))
    const projectFilter = request.nextUrl.searchParams.get("project")?.trim().toLowerCase() || null

    let updatesQuery = supabase
      .from("work_updates")
      .select("id, project_key, summary, status, commit_start, commit_end, files_touched, checkpoint_at")
      .in("status", [...REPORT_POLICY_ELIGIBLE_STATUSES])
      .order("checkpoint_at", { ascending: false })
      .limit(limit)

    if (shouldFilterByProject(projectFilter)) {
      updatesQuery = updatesQuery.eq("project_key", projectFilter)
    }

    const { data: updates, error: updatesError } = await updatesQuery
    if (updatesError) throw updatesError

    const projectKeys = Array.from(
      new Set((updates || []).map((update) => update.project_key).filter((key): key is string => Boolean(key))),
    )

    const [runsRes, existingSourceRunsRes] = await Promise.all([
      projectKeys.length
        ? supabase
            .from("ops_runs")
            .select("id, project_key, run_date")
            .in("project_key", projectKeys)
            .order("run_date", { ascending: false })
        : null,
      supabase
        .from("ops_runs")
        .select("id, source_update_id")
        .not("source_update_id", "is", null),
    ])

    const latestRunByProject = new Map<string, string>()
    const sourceUpdateToRun = new Map<string, string>()

    let warning: string | null = null

    if (runsRes?.error) {
      const code = typeof runsRes.error === "object" && runsRes.error && "code" in runsRes.error
        ? (runsRes.error as { code?: string }).code
        : null

      if (!isMissingRelationError(runsRes.error) && !(typeof code === "string" && code.startsWith("PGRST2"))) {
        warning = `Unable to query historical runs (code: ${code || "unknown"})`
      }
    }

    if (existingSourceRunsRes.error) {
      const code =
        typeof existingSourceRunsRes.error === "object" && existingSourceRunsRes.error && "code" in existingSourceRunsRes.error
          ? (existingSourceRunsRes.error as { code?: string }).code
          : null

      if (!isMissingRelationError(existingSourceRunsRes.error) && !(typeof code === "string" && code.startsWith("PGRST2"))) {
        warning = warning || `Unable to query existing source-linked runs (code: ${code || "unknown"})`
      }
    }

    for (const run of runsRes?.data || []) {
      if (!run.project_key || latestRunByProject.has(run.project_key)) continue
      latestRunByProject.set(run.project_key, run.run_date)
    }

    for (const row of existingSourceRunsRes.data || []) {
      if (!row.source_update_id) continue
      sourceUpdateToRun.set(row.source_update_id, row.id)
    }

    const now = new Date()

    const evaluations = (updates || []).map((update) => {
      const filesTouched = normalizeFilesTouched(update.files_touched)
      const policy = evaluateUpdateAsRunLogCandidate(
        {
          ...update,
          files_touched: filesTouched,
        },
        {
          lastRunDate: update.project_key ? latestRunByProject.get(update.project_key) ?? null : null,
          now,
        },
      )

      const duplicateRunId = sourceUpdateToRun.get(update.id) || null
      const eligibleByPolicy = policy.shouldCreateDraft
      const shouldCreateDraft = eligibleByPolicy && !duplicateRunId

      const policyReasons = duplicateRunId
        ? [...policy.reasons, `Run log already exists for this update (${duplicateRunId})`]
        : policy.reasons

      const projectKey = update.project_key || "project"
      const draftTitle = buildDraftTitle(update.summary)

      return {
        update,
        shouldCreateDraft,
        confidence: policy.confidence,
        reasons: policyReasons,
        existing_run_id: duplicateRunId,
        proposed_run: {
          project_key: update.project_key,
          title: draftTitle,
          summary: update.summary,
          status: "draft",
          trigger_source: "auto_policy",
          trigger_confidence: policy.confidence,
          trigger_reasons: policyReasons,
          run_date: update.checkpoint_at,
          commit_refs: [update.commit_start, update.commit_end].filter((entry): entry is string => Boolean(entry)),
          metrics_json: {
            files_touched_count: filesTouched.length,
          },
          slug_base: buildProjectDateTitleSlug({
            projectKey,
            title: draftTitle,
            date: update.checkpoint_at,
          }),
        },
      }
    })

    const candidates = evaluations.filter((item) => item.shouldCreateDraft)

    return NextResponse.json({
      generated_at: now.toISOString(),
      policy: {
        threshold_confidence: 60,
        eligible_statuses: REPORT_POLICY_ELIGIBLE_STATUSES,
      },
      warning,
      evaluated: evaluations.length,
      candidates,
      evaluations,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to evaluate run log candidates",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
