import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"
import { ensureProjectExists, OpsProjectValidationError, parseProjectScope } from "../../../../lib/server/opsProjects"
import {
  findOpsRunBySlug,
  generateUniqueRunSlug,
  normalizeRunInput,
  OpsRunValidationError,
} from "../../../../lib/server/opsRuns"

const DEFAULT_LIMIT = 120
const MAX_LIMIT = 250

function isMissingRelationError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "42P01")
}

function parseLimit(raw: string | null) {
  const parsed = raw ? Number(raw) : DEFAULT_LIMIT
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsed)))
}

async function hydrateDeepReportReferences(payload: Record<string, unknown>) {
  const deepReportId = typeof payload.deep_report_id === "string" ? payload.deep_report_id : null
  if (!deepReportId) return payload

  const { data, error } = await supabase
    .from("project_reports")
    .select("id, slug, report_url")
    .eq("id", deepReportId)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    throw new OpsRunValidationError(`deep_report_id '${deepReportId}' does not exist`)
  }

  return {
    ...payload,
    deep_report_slug: payload.deep_report_slug || data.slug || null,
    deep_report_url: payload.deep_report_url || data.report_url || null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const scope = parseProjectScope(request.nextUrl.searchParams.get("project"))
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"))

    if (scope.mode === "unassigned") {
      return NextResponse.json({ runs: [] })
    }

    let query = supabase
      .from("ops_runs")
      .select("*, deep_report:project_reports(id, project_key, title, slug, report_url)")
      .order("run_date", { ascending: false })
      .limit(limit)

    if (scope.mode === "project") {
      query = query.eq("project_key", scope.projectKey)
    }

    const { data, error } = await query
    if (!error) {
      return NextResponse.json({
        scope,
        runs: (data || []).map((run) => ({
          ...run,
          resolved_project_key: run.project_key,
        })),
      })
    }

    const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : null

    if (isMissingRelationError(error) || (typeof code === "string" && code.startsWith("PGRST2"))) {
      let fallbackQuery = supabase.from("ops_runs").select("*").order("run_date", { ascending: false }).limit(limit)
      if (scope.mode === "project") {
        fallbackQuery = fallbackQuery.eq("project_key", scope.projectKey)
      }

      const fallback = await fallbackQuery
      if (!fallback.error) {
        return NextResponse.json({
          scope,
          runs: (fallback.data || []).map((run) => ({
            ...run,
            resolved_project_key: run.project_key,
            deep_report: null,
          })),
          warning: "project_reports relation unavailable; returning ops_runs without joined deep_report rows",
        })
      }

      return NextResponse.json({
        scope,
        runs: [],
        warning: "ops_runs/project_reports schema not available yet. Apply migration 019_ops_runs_and_project_reports.sql",
      })
    }

    return NextResponse.json({
      scope,
      runs: [],
      warning: "Unable to read ops_runs right now",
      warning_code: code,
    })
  } catch (error) {
    if (error instanceof OpsRunValidationError || error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      {
        error: "Failed to load run logs",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    let payload = normalizeRunInput(body, { partial: false })

    await ensureProjectExists(payload.project_key as string)

    if (!payload.slug && typeof payload.project_key === "string" && typeof payload.title === "string") {
      payload.slug = await generateUniqueRunSlug({
        projectKey: payload.project_key,
        title: payload.title,
        date: typeof payload.run_date === "string" ? payload.run_date : null,
      })
    }

    if (typeof payload.slug === "string") {
      const existing = await findOpsRunBySlug(payload.slug)
      if (existing) {
        return NextResponse.json({ error: `slug '${payload.slug}' is already in use` }, { status: 409 })
      }
    }

    payload = await hydrateDeepReportReferences(payload)

    const { data, error } = await supabase
      .from("ops_runs")
      .insert({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .select("*, deep_report:project_reports(id, project_key, title, slug, report_url)")
      .single()

    if (error) throw error

    return NextResponse.json({ run: data }, { status: 201 })
  } catch (error) {
    if (error instanceof OpsRunValidationError || error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      {
        error: "Failed to create run log",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
