import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../../../lib/supabaseClient"
import {
  OpsProjectValidationError,
  getProjects,
  resolveProjectKeyForEntity,
} from "../../../../../../lib/server/opsProjects"
import { fetchGithubActivity } from "../../../../../../lib/server/opsGithub"

function normalizeFilesTouched(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string")
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const projectKey = resolveProjectKeyForEntity(key, null, [])

    if (!projectKey) {
      return NextResponse.json({ error: "Project key is required" }, { status: 400 })
    }

    const projects = await getProjects()
    const selectedProject = projects.find((project) => project.project_key === projectKey)

    if (!selectedProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const [focusRes, updatesRes, tasksRes, reportsRes, github] = await Promise.all([
      supabase.from("work_focus").select("*").eq("id", 1).maybeSingle(),
      supabase.from("work_updates").select("*").order("checkpoint_at", { ascending: false }).limit(250),
      supabase.from("work_tasks").select("*").order("created_at", { ascending: false }).limit(250),
      supabase
        .from("work_reports")
        .select("*")
        .eq("project_key", selectedProject.project_key)
        .order("published_at", { ascending: false })
        .limit(80),
      fetchGithubActivity(selectedProject.repo_full_name),
    ])

    if (focusRes.error) throw focusRes.error
    if (updatesRes.error) throw updatesRes.error
    if (tasksRes.error) throw tasksRes.error
    if (reportsRes.error) throw reportsRes.error

    const updates = (updatesRes.data || [])
      .map((update) => {
        const resolvedProjectKey = resolveProjectKeyForEntity(update.project_key, update.repo, projects)
        return {
          ...update,
          files_touched: normalizeFilesTouched(update.files_touched),
          resolved_project_key: resolvedProjectKey,
        }
      })
      .filter((update) => update.resolved_project_key === selectedProject.project_key)
      .slice(0, 80)

    const tasks = (tasksRes.data || [])
      .map((task) => ({
        ...task,
        resolved_project_key: resolveProjectKeyForEntity(task.project_key, task.repo_target, projects),
      }))
      .filter((task) => task.resolved_project_key === selectedProject.project_key)
      .slice(0, 120)

    const reports = (reportsRes.data || []).map((report) => ({
      ...report,
      resolved_project_key: selectedProject.project_key,
    }))

    return NextResponse.json({
      scope: { mode: "project", projectKey: selectedProject.project_key },
      focus: focusRes.data || null,
      project: selectedProject,
      github,
      updates,
      tasks,
      reports,
      summary: {
        reports: reports.length,
        checkpoints: updates.length,
        tasks: tasks.length,
      },
    })
  } catch (error) {
    if (error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      {
        error: "Failed to load project overview",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
