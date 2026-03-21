import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../../lib/supabaseClient"
import { OpsProjectValidationError, ensureProjectExists } from "../../../../../lib/server/opsProjects"
import {
  buildInternalReportPath,
  normalizeReportInput,
  ReportValidationError,
} from "../../../../../lib/server/opsReports"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>

    const normalizedUpdates = normalizeReportInput(body, { partial: true }) as Record<string, unknown>

    const { data: existingReport, error: existingError } = await supabase
      .from("work_reports")
      .select("id, project_key, project_label, slug")
      .eq("id", id)
      .single()

    if (existingError) throw existingError

    if ("project_key" in normalizedUpdates || "project_label" in normalizedUpdates) {
      const finalProjectKey =
        (typeof normalizedUpdates.project_key === "string" && normalizedUpdates.project_key) ||
        existingReport.project_key

      const finalProjectLabel =
        (typeof normalizedUpdates.project_label === "string" && normalizedUpdates.project_label) ||
        existingReport.project_label

      await ensureProjectExists(finalProjectKey, finalProjectLabel)
    }

    const nextSlug =
      "slug" in normalizedUpdates
        ? typeof normalizedUpdates.slug === "string"
          ? normalizedUpdates.slug
          : null
        : existingReport.slug

    if (nextSlug) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("work_reports")
        .select("id")
        .eq("slug", nextSlug)
        .neq("id", id)
        .maybeSingle()

      if (duplicateError) throw duplicateError
      if (duplicate) {
        throw new ReportValidationError(`slug '${nextSlug}' is already in use`)
      }

      if (!("report_url" in normalizedUpdates) || String(normalizedUpdates.report_url || "").startsWith("/reports/")) {
        normalizedUpdates.report_url = buildInternalReportPath(nextSlug)
      }
    }

    const updates = {
      ...normalizedUpdates,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from("work_reports").update(updates).eq("id", id).select("*").single()

    if (error) throw error

    return NextResponse.json({ report: data })
  } catch (error) {
    if (error instanceof ReportValidationError || error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to update report", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { error } = await supabase.from("work_reports").delete().eq("id", id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete report", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
