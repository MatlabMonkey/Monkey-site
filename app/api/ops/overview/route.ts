import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"
import {
  getProjects,
  inferProjectKeyFromRepo,
  matchesProjectScope,
  parseProjectScope,
  resolveProjectKeyForEntity,
} from "../../../../lib/server/opsProjects"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = parseProjectScope(searchParams.get("project"))

    const [focusRes, updatesRes, tasksRes, reportsRes, projects] = await Promise.all([
      supabase.from("work_focus").select("*").eq("id", 1).maybeSingle(),
      supabase.from("work_updates").select("*").order("checkpoint_at", { ascending: false }).limit(150),
      supabase.from("work_tasks").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("work_reports").select("*").order("published_at", { ascending: false }).limit(200),
      getProjects(),
    ])

    if (focusRes.error) throw focusRes.error
    if (updatesRes.error) throw updatesRes.error
    if (tasksRes.error) throw tasksRes.error
    if (reportsRes.error) throw reportsRes.error

    const updates = (updatesRes.data || []).map((update) => {
      const resolvedProjectKey = resolveProjectKeyForEntity(update.project_key, update.repo, projects)
      return {
        ...update,
        resolved_project_key: resolvedProjectKey,
        inferred_project_key:
          !update.project_key && update.repo ? inferProjectKeyFromRepo(update.repo, projects) : null,
      }
    })

    const tasks = (tasksRes.data || []).map((task) => {
      const resolvedProjectKey = resolveProjectKeyForEntity(task.project_key, task.repo_target, projects)
      return {
        ...task,
        resolved_project_key: resolvedProjectKey,
        inferred_project_key:
          !task.project_key && task.repo_target ? inferProjectKeyFromRepo(task.repo_target, projects) : null,
      }
    })

    const reports = (reportsRes.data || []).map((report) => ({
      ...report,
      resolved_project_key: resolveProjectKeyForEntity(report.project_key, null, projects),
      inferred_project_key: null,
    }))

    let runsData: Array<Record<string, unknown>> = []

    const runsRes = await supabase
      .from("ops_runs")
      .select("*, deep_report:project_reports(id, title, slug, report_url)")
      .order("run_date", { ascending: false })
      .limit(250)

    if (!runsRes.error) {
      runsData = (runsRes.data || []) as Array<Record<string, unknown>>
    } else {
      const fallbackRunsRes = await supabase.from("ops_runs").select("*").order("run_date", { ascending: false }).limit(250)
      if (!fallbackRunsRes.error) {
        runsData = (fallbackRunsRes.data || []).map((row) => ({
          ...row,
          deep_report: null,
        })) as Array<Record<string, unknown>>
      }
    }

    const runs = runsData.map((run) => ({
      ...run,
      resolved_project_key: resolveProjectKeyForEntity(
        typeof run.project_key === "string" ? run.project_key : null,
        null,
        projects,
      ),
      inferred_project_key: null,
    }))

    const scopedUpdates = updates.filter((update) => matchesProjectScope(update.resolved_project_key, scope))
    const scopedTasks = tasks.filter((task) => matchesProjectScope(task.resolved_project_key, scope))
    const scopedReports = reports.filter((report) => matchesProjectScope(report.resolved_project_key, scope))
    const scopedRuns = runs.filter((run) => matchesProjectScope(run.resolved_project_key, scope))

    return NextResponse.json({
      scope,
      focus: focusRes.data,
      updates: scopedUpdates,
      tasks: scopedTasks,
      reports: scopedReports,
      runs: scopedRuns,
      projects,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load ops overview", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
