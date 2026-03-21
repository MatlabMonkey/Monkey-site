import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../../lib/supabaseClient"
import {
  OpsProjectValidationError,
  getProjects,
  parseProjectScope,
  resolveProjectKeyForEntity,
} from "../../../../../lib/server/opsProjects"
import { fetchGithubActivity } from "../../../../../lib/server/opsGithub"

export async function GET(request: NextRequest) {
  try {
    const scope = parseProjectScope(request.nextUrl.searchParams.get("project"))
    if (scope.mode !== "project") {
      return NextResponse.json({
        scope,
        project: null,
        github: {
          configured: false,
          hint: "Select a project to view repo activity.",
          commits: [],
          pullRequests: [],
        },
        updates: [],
        reports: [],
        tasks: [],
      })
    }

    const projects = await getProjects()
    const selectedProject = projects.find((project) => project.project_key === scope.projectKey)

    if (!selectedProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const [updatesRes, reportsRes, tasksRes, github] = await Promise.all([
      supabase.from("work_updates").select("*").order("checkpoint_at", { ascending: false }).limit(200),
      supabase
        .from("work_reports")
        .select("*")
        .eq("project_key", selectedProject.project_key)
        .order("published_at", { ascending: false })
        .limit(30),
      supabase.from("work_tasks").select("*").order("created_at", { ascending: false }).limit(200),
      fetchGithubActivity(selectedProject.repo_full_name),
    ])

    if (updatesRes.error) throw updatesRes.error
    if (reportsRes.error) throw reportsRes.error
    if (tasksRes.error) throw tasksRes.error

    const updates = (updatesRes.data || [])
      .map((update) => ({
        ...update,
        resolved_project_key: resolveProjectKeyForEntity(update.project_key, update.repo, projects),
      }))
      .filter((update) => update.resolved_project_key === selectedProject.project_key)
      .slice(0, 20)

    const tasks = (tasksRes.data || [])
      .map((task) => ({
        ...task,
        resolved_project_key: resolveProjectKeyForEntity(task.project_key, task.repo_target, projects),
      }))
      .filter((task) => task.resolved_project_key === selectedProject.project_key)
      .slice(0, 40)

    return NextResponse.json({
      scope,
      project: selectedProject,
      github,
      updates,
      reports: reportsRes.data || [],
      tasks,
    })
  } catch (error) {
    if (error instanceof OpsProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      {
        error: "Failed to load project activity",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
