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
import { buildInternalReportPath, normalizeReportInput, ReportValidationError } from "../../../../lib/server/opsReports"
import { buildProjectDateTitleSlug, ensureUniqueSlug } from "../../../../lib/server/slugStrategy"

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200

async function upsertProjectReportFromWorkReport(report: Record<string, unknown>) {
  const payload = {
    project_key: String(report.project_key || ""),
    title: String(report.title || "Untitled report"),
    summary: typeof report.summary === "string" ? report.summary : null,
    kind: "deep_report",
    report_url: String(report.report_url || ""),
    slug: typeof report.slug === "string" ? report.slug : null,
    source_work_report_id: String(report.id || ""),
    metadata: {
      report_type: report.report_type,
      published_at: report.published_at,
      published_by: report.published_by,
    },
    updated_at: new Date().toISOString(),
  }

  if (!payload.project_key || !payload.report_url || !payload.source_work_report_id) return

  const { error } = await supabase.from("project_reports").upsert(payload, {
    onConflict: "source_work_report_id",
    ignoreDuplicates: false,
  })

  if (!error) return

  const maybeMissingRelation = (error as { code?: string }).code === "42P01"
  if (maybeMissingRelation) return

  throw error
}

async function findReportBySlug(slug: string) {
  const { data, error } = await supabase.from("work_reports").select("id").eq("slug", slug).maybeSingle()
  if (error) throw error
  return data
}

function hasOnSiteContent(payload: Record<string, unknown>): boolean {
  return Boolean(payload.html_content || payload.content_md || payload.content_json)
}

async function generateUniqueSlug(baseSlug: string): Promise<string> {
  try {
    return await ensureUniqueSlug(baseSlug, async (candidate) => {
      const existing = await findReportBySlug(candidate)
      return Boolean(existing)
    })
  } catch {
    throw new ReportValidationError("Unable to generate a unique slug; please provide one explicitly")
  }
}

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
    const payload = normalizeReportInput(body, { partial: false }) as Record<string, unknown>

    let slug = typeof payload.slug === "string" ? payload.slug : null

    if (!slug && hasOnSiteContent(payload) && typeof payload.title === "string") {
      const generatedBase = buildProjectDateTitleSlug({
        projectKey: String(payload.project_key || "project"),
        title: payload.title,
        date: typeof payload.published_at === "string" ? payload.published_at : new Date().toISOString(),
      })
      slug = await generateUniqueSlug(generatedBase)
      payload.slug = slug
    }

    if (slug) {
      const existing = await findReportBySlug(slug)
      if (existing) {
        throw new ReportValidationError(`slug '${slug}' is already in use`)
      }

      payload.report_url = buildInternalReportPath(slug)
    }

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

    await upsertProjectReportFromWorkReport(data as Record<string, unknown>)

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
