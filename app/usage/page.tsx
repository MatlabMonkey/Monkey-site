"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Clock3,
  ExternalLink,
  FolderKanban,
  GitBranch,
  Pencil,
  Plus,
  Save,
  X,
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

type WorkUpdate = {
  id: string
  summary: string
  repo: string | null
  branch: string | null
  project_key: string | null
  resolved_project_key: string | null
  inferred_project_key: string | null
  commit_start: string | null
  commit_end: string | null
  commit_url: string | null
  pr_url: string | null
  files_touched: string[]
  why_it_matters: string | null
  status: "in_progress" | "needs_review" | "blocked" | "shipped"
  checkpoint_at: string
}

type WorkTask = {
  id: string
  title: string
  description: string | null
  priority: "low" | "med" | "high"
  status: "inbox" | "planned" | "in_progress" | "review" | "done"
  repo_target: string | null
  project_key: string | null
  resolved_project_key: string | null
  inferred_project_key: string | null
  due_date: string | null
  notes: string | null
}

type WorkReport = {
  id: string
  project_key: string
  resolved_project_key: string | null
  project_label: string
  title: string
  summary: string
  report_type: "html" | "md" | "pdf" | "link"
  report_url: string
  slug: string | null
  html_content: string | null
  content_md: string | null
  content_json: Record<string, unknown> | null
  artifact_path: string | null
  asset_base_url: string | null
  commit_ref: string | null
  tags: string[]
  published_by: string
  published_at: string
  created_at: string
  updated_at: string
}

type GitHubData = {
  configured: boolean
  hint?: string
  error?: string
  repo?: string
  commits: Array<{ sha: string; html_url: string; message: string; author: string; date: string }>
  pullRequests: Array<{ id: number; number: number; title: string; html_url: string; user: string; updated_at: string }>
}

type ProjectActivity = {
  project: OpsProject | null
  github: GitHubData
}

type OverviewScope =
  | { mode: "all"; projectKey: null }
  | { mode: "unassigned"; projectKey: null }
  | { mode: "project"; projectKey: string }

const TASK_STATUSES: WorkTask["status"][] = ["inbox", "planned", "in_progress", "review", "done"]
const REPORT_TYPES: WorkReport["report_type"][] = ["html", "md", "pdf", "link"]

const statusClasses: Record<WorkUpdate["status"], string> = {
  in_progress: "border-sky-700 bg-sky-900/30 text-sky-200",
  needs_review: "border-violet-700 bg-violet-900/30 text-violet-200",
  blocked: "border-red-700 bg-red-900/30 text-red-200",
  shipped: "border-emerald-700 bg-emerald-900/30 text-emerald-200",
}

function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.toLowerCase()),
    ),
  )
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set"
  return new Date(value).toLocaleString()
}

function formatDate(value: string | null) {
  if (!value) return "Not set"
  return new Date(value).toLocaleDateString()
}

function getPreferredReportUrl(report: WorkReport): string {
  if (report.slug) return `/reports/${report.slug}`
  return report.report_url
}

function isInternalUrl(url: string): boolean {
  return url.startsWith("/")
}

function normalizeFilesTouched(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string")
  }
  return []
}

export default function UsageOpsDashboardPage() {
  const [focus, setFocus] = useState<Focus | null>(null)
  const [updates, setUpdates] = useState<WorkUpdate[]>([])
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [reports, setReports] = useState<WorkReport[]>([])
  const [projects, setProjects] = useState<OpsProject[]>([])
  const [activity, setActivity] = useState<ProjectActivity | null>(null)

  const [selectedScope, setSelectedScope] = useState<string>("all")
  const [serverScope, setServerScope] = useState<OverviewScope | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [focusDraft, setFocusDraft] = useState<Focus>({
    now_working_on: "",
    next_up: "",
    blocked_on: "",
    last_checkpoint_at: null,
  })
  const [isEditingFocus, setIsEditingFocus] = useState(false)

  const [taskDraft, setTaskDraft] = useState({
    title: "",
    description: "",
    priority: "med" as WorkTask["priority"],
    repo_target: "",
    due_date: "",
    notes: "",
    project_key: "",
  })

  const [taskEdits, setTaskEdits] = useState<Record<string, WorkTask>>({})

  const [showPublishPanel, setShowPublishPanel] = useState(false)
  const [isPublishingReport, setIsPublishingReport] = useState(false)
  const [reportDraft, setReportDraft] = useState({
    project_key: "",
    project_label: "",
    title: "",
    summary: "",
    report_type: "html" as WorkReport["report_type"],
    report_url: "",
    slug: "",
    html_content: "",
    content_md: "",
    asset_base_url: "",
    artifact_path: "",
    commit_ref: "",
    tags: "",
    published_by: "agent",
  })

  const [showAddProjectPanel, setShowAddProjectPanel] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [projectDraft, setProjectDraft] = useState({
    project_key: "",
    project_label: "",
    description: "",
    repo_full_name: "",
  })

  const [isSavingProjectDetail, setIsSavingProjectDetail] = useState(false)
  const [isEditingProjectDetail, setIsEditingProjectDetail] = useState(false)
  const [projectDetailDraft, setProjectDetailDraft] = useState({
    project_label: "",
    description: "",
    repo_full_name: "",
  })

  const [showTaskCreatePanel, setShowTaskCreatePanel] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const [showArchivedProjects, setShowArchivedProjects] = useState(false)

  const activeProjects = useMemo(() => projects.filter((project) => project.status === "active"), [projects])
  const archivedProjects = useMemo(() => projects.filter((project) => project.status === "archived"), [projects])

  const projectMap = useMemo(() => {
    const map = new Map<string, OpsProject>()
    for (const project of projects) map.set(project.project_key, project)
    return map
  }, [projects])

  const selectedProject = useMemo(() => {
    if (selectedScope === "all" || selectedScope === "unassigned") return null
    return projectMap.get(selectedScope) || null
  }, [projectMap, selectedScope])

  useEffect(() => {
    if (!selectedProject) {
      setProjectDetailDraft({ project_label: "", description: "", repo_full_name: "" })
      setIsEditingProjectDetail(false)
      return
    }

    setProjectDetailDraft({
      project_label: selectedProject.project_label,
      description: selectedProject.description || "",
      repo_full_name: selectedProject.repo_full_name || "",
    })
    setIsEditingProjectDetail(false)
  }, [selectedProject])

  useEffect(() => {
    if (!selectedProject) return

    setReportDraft((prev) => ({
      ...prev,
      project_key: selectedProject.project_key,
      project_label: selectedProject.project_label,
    }))
  }, [selectedProject])

  useEffect(() => {
    if (selectedScope === "all" || selectedScope === "unassigned") return
    if (projects.some((project) => project.project_key === selectedScope)) return
    setSelectedScope("all")
  }, [projects, selectedScope])

  const groupedTasks = useMemo(() => {
    return TASK_STATUSES.reduce(
      (acc, status) => {
        acc[status] = tasks.filter((task) => task.status === status)
        return acc
      },
      {} as Record<WorkTask["status"], WorkTask[]>,
    )
  }, [tasks])

  const groupedReports = useMemo(() => {
    const grouped = new Map<string, WorkReport[]>()

    for (const report of reports) {
      const label = projectMap.get(report.project_key)?.project_label || report.project_label || report.project_key
      const key = `${report.project_key}::${label}`
      const existing = grouped.get(key) || []
      existing.push(report)
      grouped.set(key, existing)
    }

    return Array.from(grouped.entries())
      .map(([key, items]) => {
        const [projectKey, projectLabel] = key.split("::")
        return {
          projectKey,
          projectLabel,
          reports: items.sort(
            (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
          ),
        }
      })
      .sort((a, b) => a.projectLabel.localeCompare(b.projectLabel))
  }, [projectMap, reports])

  const activeProjectOptions = useMemo(
    () => activeProjects.map((project) => ({ key: project.project_key, label: project.project_label })),
    [activeProjects],
  )

  async function loadAll(scope: string) {
    setError("")
    setLoading(true)

    try {
      const query = scope === "all" ? "" : `?project=${encodeURIComponent(scope)}`

      const overviewPromise = fetch(`/api/ops/overview${query}`, { cache: "no-store" })
      const projectsPromise = fetch("/api/ops/projects", { cache: "no-store" })
      const activityPromise =
        scope !== "all" && scope !== "unassigned"
          ? fetch(`/api/ops/projects/activity?project=${encodeURIComponent(scope)}`, { cache: "no-store" })
          : null

      const [overviewRes, projectsRes, activityRes] = await Promise.all([
        overviewPromise,
        projectsPromise,
        activityPromise ?? Promise.resolve(null),
      ])

      const overviewJson = (await overviewRes.json()) as {
        focus: Focus | null
        updates: WorkUpdate[]
        tasks: WorkTask[]
        reports: WorkReport[]
        scope?: OverviewScope
      }

      if (!overviewRes.ok) {
        throw new Error((overviewJson as { error?: string }).error || "Failed to load dashboard")
      }

      const projectsJson = (await projectsRes.json()) as { projects?: OpsProject[]; error?: string }
      if (!projectsRes.ok) {
        throw new Error(projectsJson.error || "Failed to load projects")
      }

      setProjects(projectsJson.projects || [])
      setServerScope(overviewJson.scope || null)
      setFocus(overviewJson.focus || null)
      setUpdates((overviewJson.updates || []).map((update) => ({ ...update, files_touched: normalizeFilesTouched(update.files_touched) })))
      setTasks(overviewJson.tasks || [])
      setReports(overviewJson.reports || [])

      setTaskEdits(
        (overviewJson.tasks || []).reduce((acc: Record<string, WorkTask>, task: WorkTask) => {
          acc[task.id] = { ...task }
          return acc
        }, {}),
      )

      setFocusDraft({
        now_working_on: overviewJson.focus?.now_working_on || "",
        next_up: overviewJson.focus?.next_up || "",
        blocked_on: overviewJson.focus?.blocked_on || "",
        last_checkpoint_at: overviewJson.focus?.last_checkpoint_at || null,
      })

      if (activityRes) {
        const activityJson = (await activityRes.json()) as ProjectActivity & { error?: string }
        if (!activityRes.ok) {
          throw new Error(activityJson.error || "Failed to load project activity")
        }

        setActivity(activityJson)
      } else {
        setActivity(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ops dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll(selectedScope)
  }, [selectedScope])

  async function saveFocus() {
    const response = await fetch("/api/ops/focus", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(focusDraft),
    })
    const json = (await response.json()) as { focus?: Focus; error?: string }
    if (!response.ok) throw new Error(json.error || "Failed to save focus")

    setFocus(json.focus || null)
    setFocusDraft({
      now_working_on: json.focus?.now_working_on || "",
      next_up: json.focus?.next_up || "",
      blocked_on: json.focus?.blocked_on || "",
      last_checkpoint_at: json.focus?.last_checkpoint_at || null,
    })
    setIsEditingFocus(false)
  }

  function beginFocusEdit() {
    setFocusDraft({
      now_working_on: focus?.now_working_on || "",
      next_up: focus?.next_up || "",
      blocked_on: focus?.blocked_on || "",
      last_checkpoint_at: focus?.last_checkpoint_at || null,
    })
    setIsEditingFocus(true)
  }

  function cancelFocusEdit() {
    setFocusDraft({
      now_working_on: focus?.now_working_on || "",
      next_up: focus?.next_up || "",
      blocked_on: focus?.blocked_on || "",
      last_checkpoint_at: focus?.last_checkpoint_at || null,
    })
    setIsEditingFocus(false)
  }

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

      const nextScope = json.project?.project_key || "all"
      setSelectedScope(nextScope)
      await loadAll(nextScope)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setIsCreatingProject(false)
    }
  }

  async function saveSelectedProjectDetail() {
    if (!selectedProject) return

    setError("")
    setIsSavingProjectDetail(true)

    try {
      const response = await fetch(`/api/ops/projects/${selectedProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_label: projectDetailDraft.project_label,
          description: projectDetailDraft.description,
          repo_full_name: projectDetailDraft.repo_full_name,
        }),
      })

      const json = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(json.error || "Failed to update project")

      await loadAll(selectedScope)
      setIsEditingProjectDetail(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project")
    } finally {
      setIsSavingProjectDetail(false)
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
      if (!response.ok) throw new Error(json.error || "Failed to update project status")

      await loadAll(selectedScope)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project status")
    }
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault()

    const selectedProjectKey =
      selectedScope === "all" ? null : selectedScope === "unassigned" ? null : selectedScope

    const response = await fetch("/api/ops/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: taskDraft.title,
        description: taskDraft.description,
        priority: taskDraft.priority,
        repo_target: taskDraft.repo_target,
        due_date: taskDraft.due_date,
        notes: taskDraft.notes,
        project_key: selectedProjectKey || taskDraft.project_key || null,
      }),
    })

    const json = (await response.json()) as { error?: string }
    if (!response.ok) throw new Error(json.error || "Failed to create task")

    setTaskDraft({
      title: "",
      description: "",
      priority: "med",
      repo_target: "",
      due_date: "",
      notes: "",
      project_key: "",
    })
    setShowTaskCreatePanel(false)
    await loadAll(selectedScope)
  }

  async function saveTask(taskId: string) {
    const draft = taskEdits[taskId]
    if (!draft) return

    const response = await fetch(`/api/ops/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        repo_target: draft.repo_target,
        project_key: draft.project_key,
        due_date: draft.due_date,
        notes: draft.notes,
        status: draft.status,
      }),
    })
    const json = (await response.json()) as { error?: string }
    if (!response.ok) throw new Error(json.error || "Failed to update task")

    await loadAll(selectedScope)
    setEditingTaskId(null)
  }

  function beginTaskEdit(task: WorkTask) {
    setTaskEdits((prev) => ({ ...prev, [task.id]: { ...task } }))
    setEditingTaskId(task.id)
  }

  function cancelTaskEdit(task: WorkTask) {
    setTaskEdits((prev) => ({ ...prev, [task.id]: { ...task } }))
    setEditingTaskId((current) => (current === task.id ? null : current))
  }

  async function publishReport(event: React.FormEvent) {
    event.preventDefault()

    setError("")
    setIsPublishingReport(true)

    const selectedProjectKey = selectedScope !== "all" && selectedScope !== "unassigned" ? selectedScope : null
    const selectedProjectLabel = selectedProject ? selectedProject.project_label : null

    try {
      const response = await fetch("/api/ops/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_key: selectedProjectKey || reportDraft.project_key,
          project_label: selectedProjectLabel || reportDraft.project_label,
          title: reportDraft.title,
          summary: reportDraft.summary,
          report_type: reportDraft.report_type,
          report_url: reportDraft.report_url,
          slug: reportDraft.slug || undefined,
          html_content: reportDraft.html_content || undefined,
          content_md: reportDraft.content_md || undefined,
          asset_base_url: reportDraft.asset_base_url || undefined,
          artifact_path: reportDraft.artifact_path,
          commit_ref: reportDraft.commit_ref,
          tags: parseTags(reportDraft.tags),
          published_by: reportDraft.published_by,
        }),
      })

      const json = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(json.error || "Failed to publish report")
      }

      setReportDraft((prev) => ({
        ...prev,
        title: "",
        summary: "",
        report_url: "",
        slug: "",
        html_content: "",
        content_md: "",
        asset_base_url: "",
        artifact_path: "",
        commit_ref: "",
        tags: "",
      }))

      await loadAll(selectedScope)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish report")
    } finally {
      setIsPublishingReport(false)
    }
  }

  const selectedScopeLabel = useMemo(() => {
    if (selectedScope === "all") return "All projects"
    if (selectedScope === "unassigned") return "Unassigned"
    return selectedProject?.project_label || selectedScope
  }, [selectedProject, selectedScope])

  if (loading) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-sky-400 mx-auto" />
            <p className="mt-3 text-slate-300">Loading ops dashboard...</p>
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
              Project-centric command center: current projects, scoped reports, checkpoints, and task flow.
            </p>
          </header>

          {error && (
            <div className="rounded-xl border border-red-800 bg-red-900/30 p-3 text-red-200 text-sm">{error}</div>
          )}

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-semibold">Current Projects</h2>
                <p className="text-sm text-slate-400 mt-1">Choose a project scope to filter reports, updates, and tasks.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProjectPanel((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
              >
                <Plus className="w-4 h-4" /> Add project
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedScope("all")}
                className={`px-3 py-2 rounded-xl text-sm border ${
                  selectedScope === "all"
                    ? "border-sky-500 bg-sky-900/40 text-sky-100"
                    : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                All projects
              </button>
              <button
                type="button"
                onClick={() => setSelectedScope("unassigned")}
                className={`px-3 py-2 rounded-xl text-sm border ${
                  selectedScope === "unassigned"
                    ? "border-amber-500 bg-amber-900/30 text-amber-100"
                    : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Unassigned
              </button>
            </div>

            {activeProjects.length === 0 ? (
              <p className="text-sm text-slate-400">No active projects yet. Add your first project to start scoping the board.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeProjects.map((project) => {
                  const isSelected = selectedScope === project.project_key
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setSelectedScope(project.project_key)}
                      className={`text-left rounded-2xl border p-4 transition ${
                        isSelected
                          ? "border-sky-500 bg-sky-900/30"
                          : "border-slate-800 bg-slate-900/80 hover:bg-slate-800/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm md:text-base">{project.project_label}</p>
                        <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border border-emerald-700 bg-emerald-900/30 text-emerald-200">active</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{project.project_key}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /> {formatDate(project.started_at)}</span>
                        <span className="inline-flex items-center gap-1"><GitBranch className="w-3 h-3" /> {project.repo_full_name || "No repo"}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

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
          </section>

          {selectedProject && (
            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg md:text-xl font-semibold">Project Detail</h2>
                  <p className="text-sm text-slate-400 mt-1">View-first summary with optional quick edits.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingProjectDetail((prev) => !prev)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
                  >
                    {isEditingProjectDetail ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                    {isEditingProjectDetail ? "Close edit" : "Edit details"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void setProjectStatus(selectedProject, selectedProject.status === "archived" ? "active" : "archived")}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
                  >
                    {selectedProject.status === "archived" ? (
                      <>
                        <ArchiveRestore className="w-4 h-4" /> Reopen project
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4" /> Archive project
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-2 text-sm">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                  <p className="mt-1 capitalize">{selectedProject.status}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Started</p>
                  <p className="mt-1">{formatDate(selectedProject.started_at)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Repo</p>
                  <p className="mt-1 break-all">{selectedProject.repo_full_name || "Not linked"}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-400">Description</p>
                <p className="mt-1 text-slate-200">{selectedProject.description || "No description yet."}</p>
              </div>

              {isEditingProjectDetail && (
                <div className="grid md:grid-cols-2 gap-2">
                  <input
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                    placeholder="Project label"
                    value={projectDetailDraft.project_label}
                    onChange={(event) => setProjectDetailDraft((prev) => ({ ...prev, project_label: event.target.value }))}
                  />
                  <input
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                    placeholder="Repo (owner/repo)"
                    value={projectDetailDraft.repo_full_name}
                    onChange={(event) => setProjectDetailDraft((prev) => ({ ...prev, repo_full_name: event.target.value }))}
                  />
                  <textarea
                    rows={2}
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                    placeholder="Description"
                    value={projectDetailDraft.description}
                    onChange={(event) => setProjectDetailDraft((prev) => ({ ...prev, description: event.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => void saveSelectedProjectDetail()}
                    disabled={isSavingProjectDetail}
                    className="md:col-span-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingProjectDetail ? "Saving..." : "Save project details"}
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg md:text-xl font-semibold">Current Focus</h2>
              {isEditingFocus ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveFocus().catch((err) => setError(err.message))}
                    className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm inline-flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelFocusEdit}
                    className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={beginFocusEdit}
                  className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
                >
                  Edit focus
                </button>
              )}
            </div>
            {isEditingFocus ? (
              <div className="grid md:grid-cols-2 gap-2 mt-4">
                <input className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700" placeholder="Now" value={focusDraft.now_working_on || ""} onChange={(e) => setFocusDraft((p) => ({ ...p, now_working_on: e.target.value }))} />
                <input className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700" placeholder="Next" value={focusDraft.next_up || ""} onChange={(e) => setFocusDraft((p) => ({ ...p, next_up: e.target.value }))} />
                <input className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2" placeholder="Blocked by" value={focusDraft.blocked_on || ""} onChange={(e) => setFocusDraft((p) => ({ ...p, blocked_on: e.target.value }))} />
              </div>
            ) : (
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
            )}
            <p className="text-xs text-slate-400 mt-3">Last checkpoint: {formatDateTime(focus?.last_checkpoint_at || null)}</p>
          </section>

          <section className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
              <h2 className="text-lg md:text-xl font-semibold">Recent GitHub Activity</h2>
              <p className="text-sm text-slate-400">
                Scope: <span className="text-slate-200">{selectedScopeLabel}</span>
                {serverScope && (
                  <span className="ml-2 text-xs text-slate-500">({serverScope.mode})</span>
                )}
              </p>

              {selectedScope === "all" || selectedScope === "unassigned" ? (
                <p className="text-sm text-slate-400">Select a specific project to view repo commits and open pull requests.</p>
              ) : !activity?.github.configured ? (
                <p className="text-sm text-slate-400">{activity?.github.hint || "No GitHub integration configured for this project."}</p>
              ) : activity.github.error ? (
                <p className="text-sm text-amber-200">{activity.github.error}</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase text-slate-400 mb-2">Recent commits</p>
                    <div className="space-y-2">
                      {activity.github.commits.map((commit) => (
                        <a key={commit.sha} href={commit.html_url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-800 p-3 hover:bg-slate-800/60">
                          <p className="text-sm line-clamp-2">{commit.message}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {commit.sha.slice(0, 7)} · {commit.author}
                          </p>
                        </a>
                      ))}
                      {activity.github.commits.length === 0 && <p className="text-sm text-slate-500">No commits found.</p>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400 mb-2">Open PRs</p>
                    <div className="space-y-2">
                      {activity.github.pullRequests.map((pr) => (
                        <a key={pr.id} href={pr.html_url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-800 p-3 hover:bg-slate-800/60">
                          <p className="text-sm">
                            #{pr.number} {pr.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">{pr.user}</p>
                        </a>
                      ))}
                      {activity.github.pullRequests.length === 0 && <p className="text-sm text-slate-500">No open PRs.</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-3">
              <h2 className="text-lg md:text-xl font-semibold">Scope Summary</h2>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Reports</p>
                  <p className="mt-1 text-lg font-semibold">{reports.length}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Checkpoints</p>
                  <p className="mt-1 text-lg font-semibold">{updates.length}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Tasks</p>
                  <p className="mt-1 text-lg font-semibold">{tasks.length}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Current selection</p>
                <p>{selectedScopeLabel}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-semibold">Published Reports</h2>
                <p className="text-sm text-slate-400 mt-1">Publishing from a selected project auto-binds project key and label.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPublishPanel((prev) => !prev)}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
              >
                {showPublishPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Agent publish panel
              </button>
            </div>

            {showPublishPanel && (
              <form onSubmit={(event) => void publishReport(event)} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 grid md:grid-cols-2 gap-2">
                <input
                  required
                  disabled={!!selectedProject}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 disabled:opacity-60"
                  placeholder="Project key (e.g. monkey-site)"
                  value={selectedProject?.project_key || reportDraft.project_key}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, project_key: e.target.value }))}
                />
                <input
                  required
                  disabled={!!selectedProject}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 disabled:opacity-60"
                  placeholder="Project label"
                  value={selectedProject?.project_label || reportDraft.project_label}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, project_label: e.target.value }))}
                />
                <input
                  required
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                  placeholder="Report title"
                  value={reportDraft.title}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, title: e.target.value }))}
                />
                <textarea
                  required
                  rows={3}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                  placeholder="Summary"
                  value={reportDraft.summary}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, summary: e.target.value }))}
                />
                <select
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                  value={reportDraft.report_type}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, report_type: e.target.value as WorkReport["report_type"] }))}
                >
                  {REPORT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <input
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                  placeholder="Published by"
                  value={reportDraft.published_by}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, published_by: e.target.value }))}
                />
                <input
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                  placeholder="Report URL (optional when slug is set)"
                  value={reportDraft.report_url}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, report_url: e.target.value }))}
                />
                <input
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                  placeholder="On-site slug (optional)"
                  value={reportDraft.slug}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, slug: e.target.value }))}
                />
                <input
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                  placeholder="Asset base URL (optional)"
                  value={reportDraft.asset_base_url}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, asset_base_url: e.target.value }))}
                />
                <textarea
                  rows={5}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                  placeholder="HTML content (optional for on-site HTML report)"
                  value={reportDraft.html_content}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, html_content: e.target.value }))}
                />
                <textarea
                  rows={3}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                  placeholder="Markdown content (optional)"
                  value={reportDraft.content_md}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, content_md: e.target.value }))}
                />
                <input
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                  placeholder="Artifact path (optional)"
                  value={reportDraft.artifact_path}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, artifact_path: e.target.value }))}
                />
                <input
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                  placeholder="Commit ref (optional)"
                  value={reportDraft.commit_ref}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, commit_ref: e.target.value }))}
                />
                <input
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                  placeholder="Tags (comma separated)"
                  value={reportDraft.tags}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, tags: e.target.value }))}
                />
                <button
                  type="submit"
                  disabled={isPublishingReport}
                  className="md:col-span-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60"
                >
                  {isPublishingReport ? "Publishing..." : "Publish report"}
                </button>
              </form>
            )}

            {reports.length === 0 ? (
              <p className="text-sm text-slate-400">No published reports in this scope yet.</p>
            ) : selectedScope === "all" ? (
              <div className="space-y-4">
                {groupedReports.map((group) => (
                  <div key={group.projectKey} className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{group.projectLabel}</h3>
                    <div className="space-y-2">
                      {group.reports.map((report) => (
                        <article key={report.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                          <div className="flex flex-wrap items-center gap-2 justify-between">
                            <p className="font-medium text-sm md:text-base">{report.title}</p>
                            <span className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-800 text-slate-300">{report.report_type}</span>
                          </div>
                          <p className="text-sm text-slate-300 mt-2">{report.summary}</p>
                          <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-400">
                            <span>Published: {formatDateTime(report.published_at)}</span>
                            {report.commit_ref && <span>Commit: {report.commit_ref}</span>}
                            <span>Project key: {report.project_key}</span>
                          </div>
                          {report.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {report.tags.map((tag) => (
                                <span key={`${report.id}-${tag}`} className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-800 text-slate-300">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {isInternalUrl(getPreferredReportUrl(report)) ? (
                            <Link
                              href={getPreferredReportUrl(report)}
                              className="mt-3 inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
                            >
                              Open report
                            </Link>
                          ) : (
                            <a
                              href={getPreferredReportUrl(report)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
                            >
                              Open report <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((report) => (
                  <article key={report.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <p className="font-medium text-sm md:text-base">{report.title}</p>
                      <span className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-800 text-slate-300">{report.report_type}</span>
                    </div>
                    <p className="text-sm text-slate-300 mt-2">{report.summary}</p>
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-400">
                      <span>Published: {formatDateTime(report.published_at)}</span>
                      {report.commit_ref && <span>Commit: {report.commit_ref}</span>}
                      <span>Project key: {report.project_key}</span>
                    </div>
                    {isInternalUrl(getPreferredReportUrl(report)) ? (
                      <Link
                        href={getPreferredReportUrl(report)}
                        className="mt-3 inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
                      >
                        Open report
                      </Link>
                    ) : (
                      <a
                        href={getPreferredReportUrl(report)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
                      >
                        Open report <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
            <h2 className="text-lg md:text-xl font-semibold">Agent Checkpoints</h2>
            {updates.length === 0 ? (
              <p className="text-sm text-slate-400">No checkpoints in this scope yet.</p>
            ) : (
              <div className="space-y-3">
                {updates.map((update) => {
                  const resolvedKey = update.resolved_project_key || null
                  const projectLabel = resolvedKey ? projectMap.get(resolvedKey)?.project_label || resolvedKey : "Unassigned"

                  return (
                    <article key={update.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <p className="font-medium">{update.summary}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full border ${statusClasses[update.status]}`}>{update.status}</span>
                          <span className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-800 text-slate-300">{projectLabel}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                        <span>{update.repo || "repo not specified"}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="w-3 h-3" /> {new Date(update.checkpoint_at).toLocaleString()}
                        </span>
                      </div>
                      {update.why_it_matters && <p className="text-sm text-slate-300 mt-2">Why it matters: {update.why_it_matters}</p>}
                      {update.files_touched.length > 0 && (
                        <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                          Files: {update.files_touched.slice(0, 6).join(", ")}
                          {update.files_touched.length > 6 ? "…" : ""}
                        </p>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg md:text-xl font-semibold">Task Inbox / Board</h2>
              <button
                type="button"
                onClick={() => setShowTaskCreatePanel((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
              >
                {showTaskCreatePanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Task input panel
              </button>
            </div>

            {showTaskCreatePanel && (
              <form onSubmit={(event) => void createTask(event).catch((err) => setError(err.message))} className="grid md:grid-cols-2 gap-2">
                <input required className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2" placeholder="Title" value={taskDraft.title} onChange={(e) => setTaskDraft((p) => ({ ...p, title: e.target.value }))} />
                <textarea className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2" rows={2} placeholder="Description / notes" value={taskDraft.description} onChange={(e) => setTaskDraft((p) => ({ ...p, description: e.target.value }))} />
                <select className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700" value={taskDraft.priority} onChange={(e) => setTaskDraft((p) => ({ ...p, priority: e.target.value as WorkTask["priority"] }))}>
                  <option value="low">low</option>
                  <option value="med">med</option>
                  <option value="high">high</option>
                </select>
                <input className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700" placeholder="Repo target" value={taskDraft.repo_target} onChange={(e) => setTaskDraft((p) => ({ ...p, repo_target: e.target.value }))} />
                {selectedProject ? (
                  <div className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-sm text-slate-200 inline-flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-sky-300" />
                    Auto-assigning to <span className="font-medium">{selectedProject.project_label}</span>
                  </div>
                ) : (
                  <select
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                    value={taskDraft.project_key}
                    onChange={(event) => setTaskDraft((prev) => ({ ...prev, project_key: event.target.value }))}
                  >
                    <option value="">Project (optional)</option>
                    {activeProjectOptions.map((projectOption) => (
                      <option key={projectOption.key} value={projectOption.key}>
                        {projectOption.label}
                      </option>
                    ))}
                    {archivedProjects.map((project) => (
                      <option key={project.id} value={project.project_key}>
                        {project.project_label} (archived)
                      </option>
                    ))}
                  </select>
                )}
                <input type="date" className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700" value={taskDraft.due_date} onChange={(e) => setTaskDraft((p) => ({ ...p, due_date: e.target.value }))} />
                <input className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2" placeholder="Extra notes" value={taskDraft.notes} onChange={(e) => setTaskDraft((p) => ({ ...p, notes: e.target.value }))} />
                <button className="md:col-span-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500">Create request</button>
              </form>
            )}

            <div className="grid lg:grid-cols-5 gap-3">
              {TASK_STATUSES.map((status) => (
                <div key={status} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">{status.replace("_", " ")}</p>
                  <div className="space-y-2 mt-2">
                    {(groupedTasks[status] || []).map((task) => {
                      const draft = taskEdits[task.id] || task
                      const resolvedKey = task.project_key || task.resolved_project_key || null
                      const resolvedLabel = resolvedKey ? projectMap.get(resolvedKey)?.project_label || resolvedKey : "Unassigned"
                      const isEditingTask = editingTaskId === task.id

                      return (
                        <article key={task.id} className="rounded-xl border border-slate-700 p-3 bg-slate-800/70 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{task.title}</p>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
                              onClick={() => (isEditingTask ? cancelTaskEdit(task) : beginTaskEdit(task))}
                            >
                              {isEditingTask ? "Close" : "Edit"}
                            </button>
                          </div>

                          <p className="text-xs text-slate-300">{task.description || "No description"}</p>
                          <div className="text-[11px] text-slate-400 space-y-1">
                            <p>Priority: {task.priority}</p>
                            <p>Scope: {resolvedLabel}</p>
                            <p>Due: {task.due_date || "Not set"}</p>
                          </div>

                          {isEditingTask && (
                            <div className="space-y-2 border-t border-slate-700 pt-2">
                              <input className="w-full text-sm px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" value={draft.title} onChange={(e) => setTaskEdits((prev) => ({ ...prev, [task.id]: { ...draft, title: e.target.value } }))} />
                              <textarea className="w-full text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" rows={2} value={draft.description || ""} onChange={(e) => setTaskEdits((prev) => ({ ...prev, [task.id]: { ...draft, description: e.target.value } }))} placeholder="Description / notes" />
                              <div className="grid grid-cols-2 gap-1">
                                <select className="text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" value={draft.priority} onChange={(e) => setTaskEdits((prev) => ({ ...prev, [task.id]: { ...draft, priority: e.target.value as WorkTask["priority"] } }))}>
                                  <option value="low">low</option>
                                  <option value="med">med</option>
                                  <option value="high">high</option>
                                </select>
                                <select className="text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" value={draft.status} onChange={(e) => setTaskEdits((prev) => ({ ...prev, [task.id]: { ...draft, status: e.target.value as WorkTask["status"] } }))}>
                                  {TASK_STATUSES.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <input className="w-full text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" placeholder="Repo target" value={draft.repo_target || ""} onChange={(e) => setTaskEdits((prev) => ({ ...prev, [task.id]: { ...draft, repo_target: e.target.value } }))} />
                              <select
                                className="w-full text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700"
                                value={draft.project_key || ""}
                                onChange={(event) =>
                                  setTaskEdits((prev) => ({
                                    ...prev,
                                    [task.id]: {
                                      ...draft,
                                      project_key: event.target.value || null,
                                    },
                                  }))
                                }
                              >
                                <option value="">Unassigned</option>
                                {activeProjectOptions.map((projectOption) => (
                                  <option key={projectOption.key} value={projectOption.key}>
                                    {projectOption.label}
                                  </option>
                                ))}
                                {archivedProjects.map((project) => (
                                  <option key={project.id} value={project.project_key}>
                                    {project.project_label} (archived)
                                  </option>
                                ))}
                              </select>
                              <input type="date" className="w-full text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" value={draft.due_date || ""} onChange={(e) => setTaskEdits((prev) => ({ ...prev, [task.id]: { ...draft, due_date: e.target.value || null } }))} />
                              <input className="w-full text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" placeholder="Notes" value={draft.notes || ""} onChange={(e) => setTaskEdits((prev) => ({ ...prev, [task.id]: { ...draft, notes: e.target.value } }))} />
                              <button type="button" className="w-full text-xs px-2 py-1 rounded-lg bg-sky-700 hover:bg-sky-600" onClick={() => void saveTask(task.id).catch((err) => setError(err.message))}>Save</button>
                            </div>
                          )}
                        </article>
                      )
                    })}
                    {(groupedTasks[status] || []).length === 0 && (
                      <div className="text-xs text-slate-500 inline-flex items-center gap-1"><CircleDashed className="w-3 h-3" />Empty</div>
                    )}
                  </div>
                </div>
              ))}
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
              {showArchivedProjects ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showArchivedProjects && (
              <div className="space-y-2">
                {archivedProjects.length === 0 ? (
                  <p className="text-sm text-slate-400">No archived projects yet.</p>
                ) : (
                  archivedProjects.map((project) => (
                    <div key={project.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedScope(project.project_key)}
                        className="text-left"
                      >
                        <p className="font-medium">{project.project_label}</p>
                        <p className="text-xs text-slate-400">
                          {project.project_key} · closed {formatDate(project.closed_at)}
                        </p>
                      </button>
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
