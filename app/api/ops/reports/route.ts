import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"
import {
  OpsProjectValidationError,
  ensureProjectExists,
  getProjects,
  matchesProjectScope,
  parseProjectScope,
  resolveProjectKeyForEntity,
} from "../../../../lib/server/opsProjects"
import { normalizeReportInput, ReportValidationError } from "../../../../lib/server/opsReports"

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = parseProjectScope(searchParams.get("project"))

    const limitParam = searchParams.get("limit")
    const parsedLimit = limitParam ? Number(limitParam) : DEFAULT_LIMIT
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsedLimit)))
      : DEFAULT_LIMIT

    let query = supabase.from("work_reports").select("*").order("published_at", { ascending: false }).limit(limit)

    if (scope.mode === "project") {
      query = query.eq("project_key", scope.projectKey)
    }

    const [reportsRes, projects] = await Promise.all([query, getProjects()])

    if (reportsRes.error) throw reportsRes.error

    const reports = (reportsRes.data || []).map((report) => ({
      ...report,
      resolved_project_key: resolveProjectKeyForEntity(report.project_key, null, projects),
    }))

    const filteredReports = reports.filter((report) => matchesProjectScope(report.resolved_project_key, scope))

    return NextResponse.json({ reports: filteredReports })
  } catch (error) {
    if (error instanceof ReportValidationError || error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to load reports", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const payload = normalizeReportInput(body, { partial: false })

    await ensureProjectExists(payload.project_key as string, payload.project_label as string)

    const { data, error } = await supabase
      .from("work_reports")
      .insert({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json({ report: data }, { status: 201 })
  } catch (error) {
    if (error instanceof ReportValidationError || error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to create report", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
