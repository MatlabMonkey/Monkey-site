import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../../lib/supabaseClient"
import { OpsProjectValidationError, normalizeProjectPatchInput } from "../../../../../lib/server/opsProjects"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const updates = normalizeProjectPatchInput(body)

    const { data: existingProject, error: existingProjectError } = await supabase
      .from("ops_projects")
      .select("id, project_key")
      .eq("id", id)
      .single()

    if (existingProjectError) throw existingProjectError

    const oldProjectKey = existingProject.project_key
    const nextProjectKey = typeof updates.project_key === "string" ? updates.project_key : oldProjectKey

    if (nextProjectKey !== oldProjectKey) {
      const { data: duplicateProject, error: duplicateError } = await supabase
        .from("ops_projects")
        .select("id")
        .eq("project_key", nextProjectKey)
        .maybeSingle()

      if (duplicateError) throw duplicateError
      if (duplicateProject && duplicateProject.id !== id) {
        return NextResponse.json(
          { error: `project_key '${nextProjectKey}' is already in use` },
          { status: 409 },
        )
      }
    }

    const { data, error } = await supabase.from("ops_projects").update(updates).eq("id", id).select("*").single()
    if (error) throw error

    if (nextProjectKey !== oldProjectKey) {
      const timestamp = new Date().toISOString()

      const [reportRes, taskRes, updateRes] = await Promise.all([
        supabase
          .from("work_reports")
          .update({ project_key: nextProjectKey, updated_at: timestamp })
          .eq("project_key", oldProjectKey),
        supabase
          .from("work_tasks")
          .update({ project_key: nextProjectKey, updated_at: timestamp })
          .eq("project_key", oldProjectKey),
        supabase
          .from("work_updates")
          .update({ project_key: nextProjectKey, updated_at: timestamp })
          .eq("project_key", oldProjectKey),
      ])

      if (reportRes.error) throw reportRes.error
      if (taskRes.error) throw taskRes.error
      if (updateRes.error) throw updateRes.error
    }

    return NextResponse.json({ project: data })
  } catch (error) {
    if (error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to update project", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
