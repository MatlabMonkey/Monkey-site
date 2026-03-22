import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../../lib/supabaseClient"
import { ensureProjectExists, getProjects, resolveProjectKeyForEntity } from "../../../../../lib/server/opsProjects"
import {
  evaluateUpdateAsRunLogCandidate,
  REPORT_POLICY_ELIGIBLE_STATUSES,
} from "../../../../../lib/server/reportPolicy"
import { generateUniqueRunSlug, RUN_TRIGGER_SOURCES } from "../../../../../lib/server/opsRuns"

type FromUpdateBody = {
  update_id?: string
  force?: boolean
  trigger_source?: string
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

function normalizeTriggerSource(value: unknown) {
  if (typeof value !== "string") return "auto_policy"
  const normalized = value.trim().toLowerCase()
  if (!RUN_TRIGGER_SOURCES.includes(normalized as (typeof RUN_TRIGGER_SOURCES)[number])) {
    return "auto_policy"
  }
  return normalized
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FromUpdateBody

    if (!body.update_id?.trim()) {
      return NextResponse.json({ error: "update_id is required" }, { status: 400 })
    }

    const { data: update, error: updateError } = await supabase
      .from("work_updates")
      .select("*")
      .eq("id", body.update_id.trim())
      .single()

    if (updateError) throw updateError

    const projects = await getProjects()
    const projectKey = resolveProjectKeyForEntity(update.project_key, update.repo, projects)

    const filesTouched = normalizeFilesTouched(update.files_touched)

    const { data: lastRun, error: lastRunError } = projectKey
      ? await supabase
          .from("ops_runs")
          .select("run_date")
          .eq("project_key", projectKey)
          .order("run_date", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null }

    if (lastRunError) throw lastRunError

    const policy = evaluateUpdateAsRunLogCandidate(
      {
        id: update.id,
        project_key: projectKey,
        status: update.status,
        summary: update.summary,
        commit_start: update.commit_start,
        commit_end: update.commit_end,
        files_touched: filesTouched,
        checkpoint_at: update.checkpoint_at,
      },
      {
        lastRunDate: lastRun?.run_date || null,
      },
    )

    const eligibleStatus = REPORT_POLICY_ELIGIBLE_STATUSES.includes(
      update.status as (typeof REPORT_POLICY_ELIGIBLE_STATUSES)[number],
    )

    if (!projectKey) {
      return NextResponse.json(
        {
          error: "Cannot create run log draft without project_key",
          policy,
        },
        { status: 400 },
      )
    }

    const { data: existingRun, error: existingRunError } = await supabase
      .from("ops_runs")
      .select("*")
      .eq("source_update_id", update.id)
      .maybeSingle()

    if (existingRunError) throw existingRunError
    if (existingRun) {
      return NextResponse.json({ run: existingRun, policy, existing: true })
    }

    if (!body.force && (!policy.shouldCreateDraft || !eligibleStatus)) {
      return NextResponse.json(
        {
          error: "Policy did not approve draft creation for this update",
          policy,
        },
        { status: 409 },
      )
    }

    await ensureProjectExists(projectKey)

    const title = buildDraftTitle(update.summary)
    const triggerSource = normalizeTriggerSource(body.trigger_source)

    const slug = await generateUniqueRunSlug({
      projectKey,
      title,
      date: update.checkpoint_at,
    })

    const insertPayload = {
      project_key: projectKey,
      source_update_id: update.id,
      title,
      summary: update.why_it_matters || update.summary,
      status: "draft",
      trigger_source: triggerSource,
      trigger_confidence: policy.confidence,
      trigger_reasons: policy.reasons,
      run_date: update.checkpoint_at || new Date().toISOString(),
      commit_refs: [update.commit_start, update.commit_end].filter((entry): entry is string => Boolean(entry)),
      checks_json: {
        status: update.status,
        branch: update.branch,
        repo: update.repo,
      },
      metrics_json: {
        files_touched_count: filesTouched.length,
      },
      artifacts_json: {
        commit_url: update.commit_url,
        pr_url: update.pr_url,
      },
      next_steps: [],
      slug,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from("ops_runs").insert(insertPayload).select("*").single()
    if (error) throw error

    return NextResponse.json({ run: data, policy }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create run log from update",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
