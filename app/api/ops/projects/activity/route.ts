import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../../lib/supabaseClient"
import {
  OpsProjectValidationError,
  getProjects,
  parseProjectScope,
  resolveProjectKeyForEntity,
} from "../../../../../lib/server/opsProjects"

type GitHubCommit = { sha: string; html_url: string; message: string; author: string; date: string }
type GitHubPr = { id: number; number: number; title: string; html_url: string; user: string; updated_at: string }

async function fetchGithubActivity(repo: string | null) {
  const token = process.env.GITHUB_TOKEN
  const normalizedRepo = repo?.trim().toLowerCase() || null

  if (!token) {
    return {
      configured: false,
      hint: "Set GITHUB_TOKEN to enable project GitHub activity.",
      repo: normalizedRepo,
      commits: [] as GitHubCommit[],
      pullRequests: [] as GitHubPr[],
    }
  }

  if (!normalizedRepo || !normalizedRepo.includes("/")) {
    return {
      configured: false,
      hint: "No repo configured for this project.",
      repo: normalizedRepo,
      commits: [] as GitHubCommit[],
      pullRequests: [] as GitHubPr[],
    }
  }

  const [owner, repoName] = normalizedRepo.split("/")

  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "Monkey-site-ops-dashboard",
  }

  try {
    const [commitsRes, prsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repoName}/commits?per_page=6`, {
        headers,
        cache: "no-store",
      }),
      fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls?state=open&per_page=6`, {
        headers,
        cache: "no-store",
      }),
    ])

    if (!commitsRes.ok || !prsRes.ok) {
      const commitsErr = commitsRes.ok ? "" : await commitsRes.text()
      const prsErr = prsRes.ok ? "" : await prsRes.text()

      return {
        configured: true,
        repo: normalizedRepo,
        error: "GitHub API request failed",
        details: `${commitsErr} ${prsErr}`.trim(),
        commits: [] as GitHubCommit[],
        pullRequests: [] as GitHubPr[],
      }
    }

    const commitsJson = (await commitsRes.json()) as any[]
    const prsJson = (await prsRes.json()) as any[]

    const commits: GitHubCommit[] = commitsJson.map((commit) => ({
      sha: commit.sha,
      html_url: commit.html_url,
      message: commit.commit?.message || "(no message)",
      author: commit.commit?.author?.name || "Unknown",
      date: commit.commit?.author?.date || "",
    }))

    const pullRequests: GitHubPr[] = prsJson.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      html_url: pr.html_url,
      user: pr.user?.login || "Unknown",
      updated_at: pr.updated_at,
    }))

    return {
      configured: true,
      repo: normalizedRepo,
      commits,
      pullRequests,
    }
  } catch (error) {
    return {
      configured: true,
      repo: normalizedRepo,
      error: "Failed to fetch GitHub activity",
      details: error instanceof Error ? error.message : String(error),
      commits: [] as GitHubCommit[],
      pullRequests: [] as GitHubPr[],
    }
  }
}

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
