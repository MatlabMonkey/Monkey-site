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

const TASK_STATUSES = ["inbox", "planned", "in_progress", "review", "done"] as const
const PRIORITIES = ["low", "med", "high"] as const

function normalizeNullableProjectKey(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") {
    throw new OpsProjectValidationError("project_key must be a string")
  }

  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.toLowerCase() === "unassigned") return null
  return resolveProjectKeyForEntity(trimmed, null, [])
}

export async function GET(request: NextRequest) {
  try {
    const scope = parseProjectScope(request.nextUrl.searchParams.get("project"))

    const [tasksRes, projects] = await Promise.all([
      supabase.from("work_tasks").select("*").order("created_at", { ascending: false }).limit(200),
      getProjects(),
    ])

    if (tasksRes.error) throw tasksRes.error

    const tasks = (tasksRes.data || []).map((task) => ({
      ...task,
      resolved_project_key: resolveProjectKeyForEntity(task.project_key, task.repo_target, projects),
    }))

    const filteredTasks = tasks.filter((task) => matchesProjectScope(task.resolved_project_key, scope))

    return NextResponse.json({ tasks: filteredTasks })
  } catch (error) {
    if (error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to load tasks", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title?: string
      description?: string
      priority?: string
      repo_target?: string
      due_date?: string
      notes?: string
      status?: string
      project_key?: string | null
    }

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    const priority = body.priority || "med"
    if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) {
      return NextResponse.json({ error: "invalid priority" }, { status: 400 })
    }

    const status = body.status || "inbox"
    if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 })
    }

    const projects = await getProjects()
    const explicitProjectKey = normalizeNullableProjectKey(body.project_key)
    const resolvedProjectKey =
      explicitProjectKey ?? resolveProjectKeyForEntity(null, body.repo_target?.trim() || null, projects)

    if (resolvedProjectKey) {
      await ensureProjectExists(resolvedProjectKey)
    }

    const { data, error } = await supabase
      .from("work_tasks")
      .insert({
        title: body.title.trim(),
        description: body.description?.trim() || null,
        priority,
        status,
        repo_target: body.repo_target?.trim() || null,
        project_key: resolvedProjectKey,
        due_date: body.due_date || null,
        notes: body.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json({ task: data }, { status: 201 })
  } catch (error) {
    if (error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to create task", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
