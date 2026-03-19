import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../../lib/supabaseClient"
import {
  OpsProjectValidationError,
  ensureProjectExists,
  getProjects,
  resolveProjectKeyForEntity,
} from "../../../../../lib/server/opsProjects"

const TASK_STATUSES = ["inbox", "planned", "in_progress", "review", "done"] as const
const PRIORITIES = ["low", "med", "high"] as const

function normalizeNullableProjectKey(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") {
    throw new OpsProjectValidationError("project_key must be a string")
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === "unassigned") return null

  return resolveProjectKeyForEntity(trimmed, null, [])
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as {
      status?: string
      priority?: string
      title?: string
      description?: string
      repo_target?: string
      due_date?: string | null
      notes?: string
      project_key?: string | null
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.status !== undefined) {
      if (!TASK_STATUSES.includes(body.status as (typeof TASK_STATUSES)[number])) {
        return NextResponse.json({ error: "invalid status" }, { status: 400 })
      }
      updates.status = body.status
      updates.completed_at = body.status === "done" ? new Date().toISOString() : null
    }

    if (body.priority !== undefined) {
      if (!PRIORITIES.includes(body.priority as (typeof PRIORITIES)[number])) {
        return NextResponse.json({ error: "invalid priority" }, { status: 400 })
      }
      updates.priority = body.priority
    }

    if (body.title !== undefined) updates.title = body.title.trim()
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.repo_target !== undefined) updates.repo_target = body.repo_target?.trim() || null
    if (body.due_date !== undefined) updates.due_date = body.due_date || null
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null

    if (body.project_key !== undefined) {
      const explicitProjectKey = normalizeNullableProjectKey(body.project_key)
      let resolvedProjectKey = explicitProjectKey

      if (!resolvedProjectKey && typeof updates.repo_target === "string") {
        const projects = await getProjects()
        resolvedProjectKey = resolveProjectKeyForEntity(null, updates.repo_target, projects)
      }

      updates.project_key = resolvedProjectKey

      if (resolvedProjectKey) {
        await ensureProjectExists(resolvedProjectKey)
      }
    }

    const { data, error } = await supabase.from("work_tasks").update(updates).eq("id", id).select("*").single()
    if (error) throw error

    return NextResponse.json({ task: data })
  } catch (error) {
    if (error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to update task", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
