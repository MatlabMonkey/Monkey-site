import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../../lib/supabaseClient"
import { ensureProjectExists, OpsProjectValidationError } from "../../../../../lib/server/opsProjects"
import {
  findOpsRunBySlug,
  generateUniqueRunSlug,
  normalizeRunInput,
  OpsRunValidationError,
} from "../../../../../lib/server/opsRuns"

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>

    let updates = normalizeRunInput(body, { partial: true })

    const { data: existing, error: existingError } = await supabase
      .from("ops_runs")
      .select("id, project_key, title, run_date, slug")
      .eq("id", id)
      .single()

    if (existingError) throw existingError

    const finalProjectKey =
      typeof updates.project_key === "string"
        ? updates.project_key
        : typeof existing.project_key === "string"
          ? existing.project_key
          : null

    if (finalProjectKey) {
      await ensureProjectExists(finalProjectKey)
    }

    let nextSlug: string | null = null

    if ("slug" in updates) {
      nextSlug = typeof updates.slug === "string" ? updates.slug : null
    } else {
      nextSlug = existing.slug
    }

    const titleForSlug =
      typeof updates.title === "string"
        ? updates.title
        : typeof existing.title === "string"
          ? existing.title
          : "run-log"

    const runDateForSlug =
      typeof updates.run_date === "string"
        ? updates.run_date
        : typeof existing.run_date === "string"
          ? existing.run_date
          : new Date().toISOString()

    if (!nextSlug && finalProjectKey && titleForSlug) {
      nextSlug = await generateUniqueRunSlug({
        projectKey: finalProjectKey,
        title: titleForSlug,
        date: runDateForSlug,
        excludeRunId: id,
      })
      updates.slug = nextSlug
    }

    if (nextSlug) {
      const duplicate = await findOpsRunBySlug(nextSlug)
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json({ error: `slug '${nextSlug}' is already in use` }, { status: 409 })
      }
    }

    updates = await hydrateDeepReportReferences(updates)

    const { data, error } = await supabase
      .from("ops_runs")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, deep_report:project_reports(id, project_key, title, slug, report_url)")
      .single()

    if (error) throw error

    return NextResponse.json({ run: data })
  } catch (error) {
    if (error instanceof OpsRunValidationError || error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      {
        error: "Failed to update run log",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
