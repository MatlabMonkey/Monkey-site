"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ClipboardList,
  Clock3,
  ExternalLink,
  FolderKanban,
  GitBranch,
  Plus,
} from "lucide-react"

type Focus = {
  now_working_on: string | null
  next_up: string | null
  blocked_on: string | null
  last_checkpoint_at: string | null
}

type OpsProject = {
  id: string
  project_key: string
  project_label: string
  description: string | null
  repo_full_name: string | null
  status: "active" | "archived"
  started_at: string
  closed_at: string | null
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

type WorkReport = {
  id: string
  project_key: string
  project_label: string
  title: string
  report_type: "html" | "md" | "pdf" | "link"
  slug: string | null
  report_url: string
  published_at: string
}

type OpsRunLog = {
  id: string
  project_key: string
  status: "draft" | "published"
  trigger_confidence: number
}

type OverviewResponse = {
  focus: Focus | null
  reports: WorkReport[]
  runs: OpsRunLog[]
  updates: Array<{ id: string }>
  tasks: Array<{ id: string }>
}

function formatDate(value: string | null) {
  if (!value) return "Not set"
  return new Date(value).toLocaleDateString()
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set"
  return new Date(value).toLocaleString()
}

function preferredReportUrl(report: WorkReport) {
  if (report.slug) return `/reports/${report.slug}`
  return report.report_url
}

function isInternalUrl(url: string) {
  return url.startsWith("/")
}

export default function UsageProjectIndexPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [focus, setFocus] = useState<Focus | null>(null)
  const [projects, setProjects] = useState<OpsProject[]>([])
  const [allReports, setAllReports] = useState<WorkReport[]>([])
  const [allRuns, setAllRuns] = useState<OpsRunLog[]>([])
  const [allTaskCount, setAllTaskCount] = useState(0)
  const [allCheckpointCount, setAllCheckpointCount] = useState(0)

  const [showArchivedProjects, setShowArchivedProjects] = useState(false)
  const [showAddProjectPanel, setShowAddProjectPanel] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [projectDraft, setProjectDraft] = useState({
    project_key: "",
    project_label: "",
    description: "",
    repo_full_name: "",
  })

  const activeProjects = useMemo(() => projects.filter((project) => project.status === "active"), [projects])
  const archivedProjects = useMemo(() => projects.filter((project) => project.status === "archived"), [projects])

  const recentReports = useMemo(
    () =>
      [...allReports]
        .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
        .slice(0, 5),
    [allReports],
  )

  const runCountByProject = useMemo(() => {
    const counts = new Map<string, number>()
    for (const run of allRuns) {
      if (!run.project_key) continue
      counts.set(run.project_key, (counts.get(run.project_key) || 0) + 1)
    }
    return counts
  }, [allRuns])

  async function loadIndex() {
    setError("")
    setLoading(true)

    try {
      const [projectsRes, overviewRes] = await Promise.all([
        fetch("/api/ops/projects", { cache: "no-store" }),
        fetch("/api/ops/overview", { cache: "no-store" }),
      ])

      const projectsJson = (await projectsRes.json()) as { projects?: OpsProject[]; error?: string }
      const overviewJson = (await overviewRes.json()) as OverviewResponse & { error?: string }

      if (!projectsRes.ok) throw new Error(projectsJson.error || "Failed to load projects")
      if (!overviewRes.ok) throw new Error(overviewJson.error || "Failed to load summary")

      setProjects(projectsJson.projects || [])
      setFocus(overviewJson.focus || null)
      setAllReports(overviewJson.reports || [])
      setAllRuns(overviewJson.runs || [])
      setAllTaskCount(overviewJson.tasks?.length || 0)
      setAllCheckpointCount(overviewJson.updates?.length || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load usage index")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadIndex()
  }, [])

  async function createProject(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setIsCreatingProject(true)

    try {
      const response = await fetch("/api/ops/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_key: projectDraft.project_key || undefined,
          project_label: projectDraft.project_label,
          description: projectDraft.description,
          repo_full_name: projectDraft.repo_full_name,
        }),
      })

      const json = (await response.json()) as { project?: OpsProject; error?: string }
      if (!response.ok) throw new Error(json.error || "Failed to create project")

      setProjectDraft({ project_key: "", project_label: "", description: "", repo_full_name: "" })
      setShowAddProjectPanel(false)
      await loadIndex()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setIsCreatingProject(false)
    }
  }

  async function setProjectStatus(project: OpsProject, status: OpsProject["status"]) {
    setError("")

    try {
      const response = await fetch(`/api/ops/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      const json = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(json.error || "Failed to update project")

      await loadIndex()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-sky-400 mx-auto" />
          <p className="mt-3 text-slate-300">Loading project index...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
            <ArrowLeft className="w-4 h-4" />
            Back home
          </Link>
          <h1 className="text-2xl md:text-4xl font-bold mt-2">Ops Dashboard</h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            Project index. Open a project to view scoped reports, checkpoints, tasks, and GitHub activity.
          </p>
        </header>

        {error && <div className="rounded-xl border border-red-800 bg-red-900/30 p-3 text-red-200 text-sm">{error}</div>}

        <section className="grid lg:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Active projects</p>
            <p className="mt-1 text-2xl font-semibold">{activeProjects.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Reports</p>
            <p className="mt-1 text-2xl font-semibold">{allReports.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Run Logs</p>
            <p className="mt-1 text-2xl font-semibold">{allRuns.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Checkpoints</p>
            <p className="mt-1 text-2xl font-semibold">{allCheckpointCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Tasks</p>
            <p className="mt-1 text-2xl font-semibold">{allTaskCount}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg md:text-xl font-semibold">Active Projects</h2>
              <p className="text-sm text-slate-400 mt-1">Project cards now navigate to dedicated pages.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddProjectPanel((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
            >
              <Plus className="w-4 h-4" /> Add project
            </button>
          </div>

          {showAddProjectPanel && (
            <form onSubmit={(event) => void createProject(event)} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 grid md:grid-cols-2 gap-2">
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="Project key (optional, slug)"
                value={projectDraft.project_key}
                onChange={(event) => setProjectDraft((prev) => ({ ...prev, project_key: event.target.value }))}
              />
              <input
                required
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="Project label"
                value={projectDraft.project_label}
                onChange={(event) => setProjectDraft((prev) => ({ ...prev, project_label: event.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="Repo (owner/repo)"
                value={projectDraft.repo_full_name}
                onChange={(event) => setProjectDraft((prev) => ({ ...prev, repo_full_name: event.target.value }))}
              />
              <textarea
                rows={2}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="Description (optional)"
                value={projectDraft.description}
                onChange={(event) => setProjectDraft((prev) => ({ ...prev, description: event.target.value }))}
              />
              <button
                type="submit"
                disabled={isCreatingProject}
                className="md:col-span-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60"
              >
                {isCreatingProject ? "Creating project..." : "Create project"}
              </button>
            </form>
          )}

          {activeProjects.length === 0 ? (
            <p className="text-sm text-slate-400">No active projects yet. Add your first project above.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeProjects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:bg-slate-800/80 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm md:text-base">{project.project_label}</p>
                    <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border border-emerald-700 bg-emerald-900/30 text-emerald-200">
                      active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{project.project_key}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="w-3 h-3" /> {formatDate(project.started_at)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <GitBranch className="w-3 h-3" /> {project.repo_full_name || "No repo"}
                    </span>
                  </div>
                  {project.description && <p className="text-xs text-slate-300 mt-3 line-clamp-2">{project.description}</p>}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-800 text-slate-300">
                      <ClipboardList className="w-3 h-3" /> Run Logs: {runCountByProject.get(project.project_key) || 0}
                    </span>
                    <Link
                      href={`/usage/projects/${encodeURIComponent(project.project_key)}`}
                      className="inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
                    >
                      Open project <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                  <Link
                    href={`/usage/projects/${encodeURIComponent(project.project_key)}#run-logs`}
                    className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    <ClipboardList className="w-3 h-3" /> Run Logs
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold">Global Focus Snapshot</h2>
            <div className="grid md:grid-cols-2 gap-2 mt-4 text-sm">
              <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Now</p>
                <p>{focus?.now_working_on || "Not set"}</p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Next</p>
                <p>{focus?.next_up || "Not set"}</p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Blocked by</p>
                <p>{focus?.blocked_on || "Nothing currently blocking"}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">Last checkpoint: {formatDateTime(focus?.last_checkpoint_at || null)}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-3">
            <h2 className="text-lg md:text-xl font-semibold">Recent Reports</h2>
            {recentReports.length === 0 ? (
              <p className="text-sm text-slate-400">No published reports yet.</p>
            ) : (
              <div className="space-y-2">
                {recentReports.map((report) => {
                  const href = preferredReportUrl(report)
                  return (
                    <article key={report.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-sm">
                      <p className="font-medium">{report.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{report.project_label} · {new Date(report.published_at).toLocaleString()}</p>
                      {isInternalUrl(href) ? (
                        <Link href={href} className="mt-2 inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
                          Open report
                        </Link>
                      ) : (
                        <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
                          Open report <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-3">
          <button
            type="button"
            onClick={() => setShowArchivedProjects((prev) => !prev)}
            className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
          >
            <span className="inline-flex items-center gap-2">
              <Archive className="w-4 h-4" />
              Archived Projects ({archivedProjects.length})
            </span>
            {showArchivedProjects ? <ArchiveRestore className="w-4 h-4" /> : <FolderKanban className="w-4 h-4" />}
          </button>

          {showArchivedProjects && (
            <div className="space-y-2">
              {archivedProjects.length === 0 ? (
                <p className="text-sm text-slate-400">No archived projects yet.</p>
              ) : (
                archivedProjects.map((project) => (
                  <div key={project.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <Link href={`/usage/projects/${encodeURIComponent(project.project_key)}`} className="text-left">
                      <p className="font-medium">{project.project_label}</p>
                      <p className="text-xs text-slate-400">
                        {project.project_key} · closed {formatDate(project.closed_at)}
                      </p>
                    </Link>
                    <button
                      type="button"
                      onClick={() => void setProjectStatus(project, "active")}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
                    >
                      <ArchiveRestore className="w-4 h-4" /> Reopen
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
