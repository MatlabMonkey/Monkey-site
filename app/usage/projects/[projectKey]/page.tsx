"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  ClipboardList,
  Clock3,
  ExternalLink,
  GitBranch,
  Pencil,
  Plus,
  RefreshCcw,
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
  due_date: string | null
  notes: string | null
}

type WorkReport = {
  id: string
  project_key: string
  project_label: string
  title: string
  summary: string
  report_type: "html" | "md" | "pdf" | "link"
  report_url: string
  slug: string | null
  commit_ref: string | null
  tags: string[]
  published_by: string
  published_at: string
}

type OpsRunLog = {
  id: string
  project_key: string
  title: string
  summary: string
  status: "draft" | "published"
  trigger_source: "auto_policy" | "manual" | "subagent" | "push"
  trigger_confidence: number
  trigger_reasons: string[]
  run_date: string
  slug: string | null
  deep_report_id: string | null
  deep_report_slug: string | null
  deep_report_url: string | null
  deep_report?: {
    id: string
    title: string
    slug: string | null
    report_url: string
  } | null
}

type GitHubData = {
  configured: boolean
  hint?: string
  error?: string
  repo?: string
  commits: Array<{ sha: string; html_url: string; message: string; author: string; date: string }>
  pullRequests: Array<{ id: number; number: number; title: string; html_url: string; user: string; updated_at: string }>
}

type ProjectOverviewResponse = {
  focus: Focus | null
  project: OpsProject
  github: GitHubData
  updates: WorkUpdate[]
  tasks: WorkTask[]
  reports: WorkReport[]
  runs: OpsRunLog[]
  summary: {
    reports: number
    run_logs: number
    checkpoints: number
    tasks: number
  }
}

const TASK_STATUSES: WorkTask["status"][] = ["inbox", "planned", "in_progress", "review", "done"]
const REPORT_TYPES: WorkReport["report_type"][] = ["html", "md", "pdf", "link"]

const statusClasses: Record<WorkUpdate["status"], string> = {
  in_progress: "border-sky-700 bg-sky-900/30 text-sky-200",
  needs_review: "border-violet-700 bg-violet-900/30 text-violet-200",
  blocked: "border-red-700 bg-red-900/30 text-red-200",
  shipped: "border-emerald-700 bg-emerald-900/30 text-emerald-200",
}

function formatDate(value: string | null) {
  if (!value) return "Not set"
  return new Date(value).toLocaleDateString()
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set"
  return new Date(value).toLocaleString()
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

function getPreferredReportUrl(report: WorkReport): string {
  if (report.slug) return `/reports/${report.slug}`
  return report.report_url
}

function getRunDeepReportUrl(run: OpsRunLog): string | null {
  if (run.deep_report?.slug) return `/reports/${run.deep_report.slug}`
  if (run.deep_report_slug) return `/reports/${run.deep_report_slug}`
  if (run.deep_report?.report_url) return run.deep_report.report_url
  if (run.deep_report_url) return run.deep_report_url
  return null
}

function isInternalUrl(url: string): boolean {
  return url.startsWith("/")
}

export default function UsageProjectPage() {
  const params = useParams<{ projectKey: string }>()
  const router = useRouter()

  const rawParamProjectKey = params?.projectKey
  const routeProjectKey = Array.isArray(rawParamProjectKey) ? rawParamProjectKey[0] : rawParamProjectKey

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [focus, setFocus] = useState<Focus | null>(null)
  const [project, setProject] = useState<OpsProject | null>(null)
  const [updates, setUpdates] = useState<WorkUpdate[]>([])
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [reports, setReports] = useState<WorkReport[]>([])
  const [runs, setRuns] = useState<OpsRunLog[]>([])
  const [github, setGithub] = useState<GitHubData | null>(null)
  const [summary, setSummary] = useState({ reports: 0, run_logs: 0, checkpoints: 0, tasks: 0 })

  const [isEditingProjectDetail, setIsEditingProjectDetail] = useState(false)
  const [isSavingProjectDetail, setIsSavingProjectDetail] = useState(false)
  const [projectDetailDraft, setProjectDetailDraft] = useState({
    project_label: "",
    description: "",
    repo_full_name: "",
  })

  const [showTaskCreatePanel, setShowTaskCreatePanel] = useState(false)
  const [showCheckpointPanel, setShowCheckpointPanel] = useState(false)
  const [showPublishPanel, setShowPublishPanel] = useState(false)

  const [taskDraft, setTaskDraft] = useState({
    title: "",
    description: "",
    priority: "med" as WorkTask["priority"],
    repo_target: "",
    due_date: "",
    notes: "",
  })

  const [checkpointDraft, setCheckpointDraft] = useState({
    summary: "",
    status: "in_progress" as WorkUpdate["status"],
    repo: "",
    branch: "",
    why_it_matters: "",
    pr_url: "",
  })

  const [reportDraft, setReportDraft] = useState({
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

  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isCreatingCheckpoint, setIsCreatingCheckpoint] = useState(false)
  const [isPublishingReport, setIsPublishingReport] = useState(false)

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [taskEdits, setTaskEdits] = useState<Record<string, WorkTask>>({})
  const [expandedRunIds, setExpandedRunIds] = useState<Record<string, boolean>>({})
  const [publishingRunId, setPublishingRunId] = useState<string | null>(null)

  const groupedTasks = useMemo(() => {
    return TASK_STATUSES.reduce(
      (acc, status) => {
        acc[status] = tasks.filter((task) => task.status === status)
        return acc
      },
      {} as Record<WorkTask["status"], WorkTask[]>,
    )
  }, [tasks])

  async function loadProjectPage(projectKey: string) {
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/ops/project/${encodeURIComponent(projectKey)}/overview`, {
        cache: "no-store",
      })

      const json = (await response.json()) as ProjectOverviewResponse & { error?: string }
      if (!response.ok) {
        throw new Error(json.error || "Failed to load project overview")
      }

      setFocus(json.focus || null)
      setProject(json.project)
      setUpdates(json.updates || [])
      setTasks(json.tasks || [])
      setReports(json.reports || [])
      setRuns(json.runs || [])
      setGithub(json.github || null)
      setSummary(json.summary || { reports: 0, run_logs: 0, checkpoints: 0, tasks: 0 })

      setProjectDetailDraft({
        project_label: json.project.project_label,
        description: json.project.description || "",
        repo_full_name: json.project.repo_full_name || "",
      })

      setTaskEdits(
        (json.tasks || []).reduce((acc: Record<string, WorkTask>, task) => {
          acc[task.id] = { ...task }
          return acc
        }, {}),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project page")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!routeProjectKey) {
      setError("Project key not found in URL")
      setLoading(false)
      return
    }

    void loadProjectPage(routeProjectKey)
  }, [routeProjectKey])

  async function saveProjectDetail() {
    if (!project) return

    setError("")
    setIsSavingProjectDetail(true)

    try {
      const response = await fetch(`/api/ops/projects/${project.id}`, {
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

      await loadProjectPage(project.project_key)
      setIsEditingProjectDetail(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project")
    } finally {
      setIsSavingProjectDetail(false)
    }
  }

  async function setProjectStatus(status: OpsProject["status"]) {
    if (!project) return

    setError("")

    try {
      const response = await fetch(`/api/ops/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      const json = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(json.error || "Failed to update project status")

      await loadProjectPage(project.project_key)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project status")
    }
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault()
    if (!project) return

    setError("")
    setIsCreatingTask(true)

    try {
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
          project_key: project.project_key,
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
      })
      setShowTaskCreatePanel(false)
      await loadProjectPage(project.project_key)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task")
    } finally {
      setIsCreatingTask(false)
    }
  }

  async function createCheckpoint(event: React.FormEvent) {
    event.preventDefault()
    if (!project) return

    setError("")
    setIsCreatingCheckpoint(true)

    try {
      const response = await fetch("/api/ops/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: checkpointDraft.summary,
          status: checkpointDraft.status,
          repo: checkpointDraft.repo,
          branch: checkpointDraft.branch,
          why_it_matters: checkpointDraft.why_it_matters,
          pr_url: checkpointDraft.pr_url,
          project_key: project.project_key,
        }),
      })

      const json = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(json.error || "Failed to create checkpoint")

      setCheckpointDraft({
        summary: "",
        status: "in_progress",
        repo: "",
        branch: "",
        why_it_matters: "",
        pr_url: "",
      })
      setShowCheckpointPanel(false)
      await loadProjectPage(project.project_key)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create checkpoint")
    } finally {
      setIsCreatingCheckpoint(false)
    }
  }

  async function publishReport(event: React.FormEvent) {
    event.preventDefault()
    if (!project) return

    setError("")
    setIsPublishingReport(true)

    try {
      const response = await fetch("/api/ops/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_key: project.project_key,
          project_label: project.project_label,
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
      if (!response.ok) throw new Error(json.error || "Failed to publish report")

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
      setShowPublishPanel(false)
      await loadProjectPage(project.project_key)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish report")
    } finally {
      setIsPublishingReport(false)
    }
  }

  function beginTaskEdit(task: WorkTask) {
    setTaskEdits((prev) => ({ ...prev, [task.id]: { ...task } }))
    setEditingTaskId(task.id)
  }

  function cancelTaskEdit(task: WorkTask) {
    setTaskEdits((prev) => ({ ...prev, [task.id]: { ...task } }))
    setEditingTaskId((current) => (current === task.id ? null : current))
  }

  async function saveTask(taskId: string) {
    if (!project) return
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
        due_date: draft.due_date,
        notes: draft.notes,
        status: draft.status,
        project_key: project.project_key,
      }),
    })

    const json = (await response.json()) as { error?: string }
    if (!response.ok) throw new Error(json.error || "Failed to update task")

    await loadProjectPage(project.project_key)
    setEditingTaskId(null)
  }

  async function publishRunLog(runId: string) {
    if (!project) return

    setPublishingRunId(runId)
    setError("")

    try {
      const response = await fetch(`/api/ops/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      })

      const json = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(json.error || "Failed to publish run log")

      await loadProjectPage(project.project_key)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish run log")
    } finally {
      setPublishingRunId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-sky-400 mx-auto" />
          <p className="mt-3 text-slate-300">Loading project dashboard...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
          <Link href="/usage" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
            <ArrowLeft className="w-4 h-4" />
            Back to project index
          </Link>
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4">
            <p className="text-red-200">{error || "Project not found."}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/usage" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
              <ArrowLeft className="w-4 h-4" />
              Back to project index
            </Link>
            <button
              type="button"
              onClick={() => void loadProjectPage(project.project_key)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
            >
              <RefreshCcw className="w-4 h-4" /> Refresh
            </button>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">{project.project_key}</p>
              <h1 className="text-2xl md:text-4xl font-bold mt-1">{project.project_label}</h1>
              <p className="text-slate-300 mt-2 text-sm md:text-base">{project.description || "No project description yet."}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingProjectDetail((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
              >
                {isEditingProjectDetail ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                {isEditingProjectDetail ? "Close edit" : "Edit"}
              </button>

              <button
                type="button"
                onClick={() =>
                  void setProjectStatus(project.status === "archived" ? "active" : "archived")
                }
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
              >
                {project.status === "archived" ? (
                  <>
                    <ArchiveRestore className="w-4 h-4" /> Reopen
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" /> Archive
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-2 text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
              <p className="mt-1 capitalize">{project.status}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Started</p>
              <p className="mt-1">{formatDate(project.started_at)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Repo</p>
              <p className="mt-1 break-all">{project.repo_full_name || "Not linked"}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-2 text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Reports</p>
              <p className="mt-1 text-lg font-semibold">{summary.reports}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Run Logs</p>
              <p className="mt-1 text-lg font-semibold">{summary.run_logs}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Checkpoints</p>
              <p className="mt-1 text-lg font-semibold">{summary.checkpoints}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Tasks</p>
              <p className="mt-1 text-lg font-semibold">{summary.tasks}</p>
            </div>
          </div>

          {isEditingProjectDetail && (
            <div className="grid md:grid-cols-2 gap-2 border-t border-slate-800 pt-4">
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="Project label"
                value={projectDetailDraft.project_label}
                onChange={(event) =>
                  setProjectDetailDraft((prev) => ({ ...prev, project_label: event.target.value }))
                }
              />
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="Repo (owner/repo)"
                value={projectDetailDraft.repo_full_name}
                onChange={(event) =>
                  setProjectDetailDraft((prev) => ({ ...prev, repo_full_name: event.target.value }))
                }
              />
              <textarea
                rows={2}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="Description"
                value={projectDetailDraft.description}
                onChange={(event) =>
                  setProjectDetailDraft((prev) => ({ ...prev, description: event.target.value }))
                }
              />
              <button
                type="button"
                onClick={() => void saveProjectDetail()}
                disabled={isSavingProjectDetail}
                className="md:col-span-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSavingProjectDetail ? "Saving..." : "Save details"}
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-800 bg-red-900/30 p-3 text-red-200 text-sm">{error}</div>
          )}
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowTaskCreatePanel((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
            >
              {showTaskCreatePanel ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Task
            </button>
            <button
              type="button"
              onClick={() => setShowCheckpointPanel((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
            >
              {showCheckpointPanel ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Checkpoint
            </button>
            <button
              type="button"
              onClick={() => setShowPublishPanel((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
            >
              {showPublishPanel ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Report
            </button>
          </div>

          {showTaskCreatePanel && (
            <form onSubmit={(event) => void createTask(event)} className="grid md:grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <input
                required
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="Title"
                value={taskDraft.title}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
              <textarea
                rows={2}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="Description"
                value={taskDraft.description}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, description: event.target.value }))}
              />
              <select
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                value={taskDraft.priority}
                onChange={(event) =>
                  setTaskDraft((prev) => ({ ...prev, priority: event.target.value as WorkTask["priority"] }))
                }
              >
                <option value="low">low</option>
                <option value="med">med</option>
                <option value="high">high</option>
              </select>
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="Repo target"
                value={taskDraft.repo_target}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, repo_target: event.target.value }))}
              />
              <input
                type="date"
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                value={taskDraft.due_date}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, due_date: event.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="Extra notes"
                value={taskDraft.notes}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, notes: event.target.value }))}
              />
              <p className="md:col-span-2 text-xs text-slate-400">Will be attached to project: {project.project_key}</p>
              <button
                type="submit"
                disabled={isCreatingTask}
                className="md:col-span-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60"
              >
                {isCreatingTask ? "Creating task..." : "Create task"}
              </button>
            </form>
          )}

          {showCheckpointPanel && (
            <form
              onSubmit={(event) => void createCheckpoint(event)}
              className="grid md:grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-4"
            >
              <input
                required
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="Checkpoint summary"
                value={checkpointDraft.summary}
                onChange={(event) =>
                  setCheckpointDraft((prev) => ({ ...prev, summary: event.target.value }))
                }
              />
              <select
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                value={checkpointDraft.status}
                onChange={(event) =>
                  setCheckpointDraft((prev) => ({
                    ...prev,
                    status: event.target.value as WorkUpdate["status"],
                  }))
                }
              >
                <option value="in_progress">in_progress</option>
                <option value="needs_review">needs_review</option>
                <option value="blocked">blocked</option>
                <option value="shipped">shipped</option>
              </select>
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="Repo (optional)"
                value={checkpointDraft.repo}
                onChange={(event) => setCheckpointDraft((prev) => ({ ...prev, repo: event.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="Branch"
                value={checkpointDraft.branch}
                onChange={(event) => setCheckpointDraft((prev) => ({ ...prev, branch: event.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="PR URL (optional)"
                value={checkpointDraft.pr_url}
                onChange={(event) => setCheckpointDraft((prev) => ({ ...prev, pr_url: event.target.value }))}
              />
              <textarea
                rows={2}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="Why it matters"
                value={checkpointDraft.why_it_matters}
                onChange={(event) =>
                  setCheckpointDraft((prev) => ({ ...prev, why_it_matters: event.target.value }))
                }
              />
              <p className="md:col-span-2 text-xs text-slate-400">Will be attached to project: {project.project_key}</p>
              <button
                type="submit"
                disabled={isCreatingCheckpoint}
                className="md:col-span-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60"
              >
                {isCreatingCheckpoint ? "Saving checkpoint..." : "Add checkpoint"}
              </button>
            </form>
          )}

          {showPublishPanel && (
            <form
              onSubmit={(event) => void publishReport(event)}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 grid md:grid-cols-2 gap-2"
            >
              <div className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-sm text-slate-200">
                Project: {project.project_label}
              </div>
              <div className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-sm text-slate-200">
                Key: {project.project_key}
              </div>
              <input
                required
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="Report title"
                value={reportDraft.title}
                onChange={(event) => setReportDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
              <textarea
                required
                rows={3}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="Summary"
                value={reportDraft.summary}
                onChange={(event) => setReportDraft((prev) => ({ ...prev, summary: event.target.value }))}
              />
              <select
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                value={reportDraft.report_type}
                onChange={(event) =>
                  setReportDraft((prev) => ({ ...prev, report_type: event.target.value as WorkReport["report_type"] }))
                }
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
                onChange={(event) => setReportDraft((prev) => ({ ...prev, published_by: event.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="Report URL (optional when slug set)"
                value={reportDraft.report_url}
                onChange={(event) => setReportDraft((prev) => ({ ...prev, report_url: event.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="On-site slug (optional)"
                value={reportDraft.slug}
                onChange={(event) => setReportDraft((prev) => ({ ...prev, slug: event.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="Asset base URL (optional)"
                value={reportDraft.asset_base_url}
                onChange={(event) =>
                  setReportDraft((prev) => ({ ...prev, asset_base_url: event.target.value }))
                }
              />
              <textarea
                rows={5}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="HTML content (optional)"
                value={reportDraft.html_content}
                onChange={(event) => setReportDraft((prev) => ({ ...prev, html_content: event.target.value }))}
              />
              <textarea
                rows={3}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="Markdown content (optional)"
                value={reportDraft.content_md}
                onChange={(event) => setReportDraft((prev) => ({ ...prev, content_md: event.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="Artifact path (optional)"
                value={reportDraft.artifact_path}
                onChange={(event) => setReportDraft((prev) => ({ ...prev, artifact_path: event.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                placeholder="Commit ref (optional)"
                value={reportDraft.commit_ref}
                onChange={(event) => setReportDraft((prev) => ({ ...prev, commit_ref: event.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                placeholder="Tags (comma separated)"
                value={reportDraft.tags}
                onChange={(event) => setReportDraft((prev) => ({ ...prev, tags: event.target.value }))}
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
        </section>

        <section id="run-logs" className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg md:text-xl font-semibold inline-flex items-center gap-2">
                <ClipboardList className="w-5 h-5" /> Run Logs
              </h2>
              <p className="text-sm text-slate-400 mt-1">Ops layer: lightweight run summaries linked to deeper reports.</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-800 text-slate-300">
              {runs.length} total
            </span>
          </div>

          {runs.length === 0 ? (
            <p className="text-sm text-slate-400">No run logs for this project yet.</p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => {
                const deepReportUrl = getRunDeepReportUrl(run)
                const isExpanded = Boolean(expandedRunIds[run.id])

                return (
                  <article key={run.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-sm md:text-base">{run.title}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full border ${
                            run.status === "published"
                              ? "border-emerald-700 bg-emerald-900/30 text-emerald-200"
                              : "border-amber-700 bg-amber-900/30 text-amber-200"
                          }`}
                        >
                          {run.status}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-800 text-slate-300">
                          confidence {Math.max(0, Math.min(100, Math.round(run.trigger_confidence || 0)))}
                        </span>
                        {run.status === "draft" && (
                          <button
                            type="button"
                            disabled={publishingRunId === run.id}
                            onClick={() => void publishRunLog(run.id)}
                            className="text-xs px-2 py-1 rounded-lg border border-sky-700 bg-sky-900/40 text-sky-200 hover:bg-sky-900/60 disabled:opacity-60"
                          >
                            {publishingRunId === run.id ? "Publishing..." : "Quick publish"}
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-slate-300">{run.summary}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>Run date: {formatDateTime(run.run_date)}</span>
                      <span>Trigger: {run.trigger_source}</span>
                      {run.slug && <span>slug: {run.slug}</span>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {deepReportUrl && (
                        isInternalUrl(deepReportUrl) ? (
                          <Link
                            href={deepReportUrl}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-700 bg-slate-800 text-sky-300 hover:text-sky-200"
                          >
                            Open deep report
                          </Link>
                        ) : (
                          <a
                            href={deepReportUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-700 bg-slate-800 text-sky-300 hover:text-sky-200"
                          >
                            Open deep report <ExternalLink className="w-3 h-3" />
                          </a>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRunIds((prev) => ({
                            ...prev,
                            [run.id]: !prev[run.id],
                          }))
                        }
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? "Hide details" : "Show details"}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Trigger reasons</p>
                        {run.trigger_reasons.length === 0 ? (
                          <p className="text-xs text-slate-500">No trigger reasons recorded.</p>
                        ) : (
                          <ul className="list-disc pl-5 text-xs text-slate-300 space-y-1">
                            {run.trigger_reasons.map((reason, index) => (
                              <li key={`${run.id}-${index}`}>{reason}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
            <h2 className="text-lg md:text-xl font-semibold">Published Reports</h2>
            {reports.length === 0 ? (
              <p className="text-sm text-slate-400">No published reports for this project yet.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((report) => (
                  <article key={report.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <p className="font-medium text-sm md:text-base">{report.title}</p>
                      <span className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-800 text-slate-300">
                        {report.report_type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mt-2">{report.summary}</p>
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-400">
                      <span>Published: {formatDateTime(report.published_at)}</span>
                      {report.commit_ref && <span>Commit: {report.commit_ref}</span>}
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
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
            <h2 className="text-lg md:text-xl font-semibold">Recent GitHub Activity</h2>
            {!github?.configured ? (
              <p className="text-sm text-slate-400">{github?.hint || "No GitHub integration configured for this project."}</p>
            ) : github.error ? (
              <p className="text-sm text-amber-200">{github.error}</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase text-slate-400 mb-2">Recent commits</p>
                  <div className="space-y-2">
                    {github.commits.map((commit) => (
                      <a
                        key={commit.sha}
                        href={commit.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-slate-800 p-3 hover:bg-slate-800/60"
                      >
                        <p className="text-sm line-clamp-2">{commit.message}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {commit.sha.slice(0, 7)} · {commit.author}
                        </p>
                      </a>
                    ))}
                    {github.commits.length === 0 && <p className="text-sm text-slate-500">No commits found.</p>}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400 mb-2">Open PRs</p>
                  <div className="space-y-2">
                    {github.pullRequests.map((pr) => (
                      <a
                        key={pr.id}
                        href={pr.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-slate-800 p-3 hover:bg-slate-800/60"
                      >
                        <p className="text-sm">
                          #{pr.number} {pr.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">{pr.user}</p>
                      </a>
                    ))}
                    {github.pullRequests.length === 0 && <p className="text-sm text-slate-500">No open PRs.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
          <h2 className="text-lg md:text-xl font-semibold">Agent Checkpoints</h2>
          <p className="text-sm text-slate-400">Last global checkpoint: {formatDateTime(focus?.last_checkpoint_at || null)}</p>
          {updates.length === 0 ? (
            <p className="text-sm text-slate-400">No checkpoints for this project yet.</p>
          ) : (
            <div className="space-y-3">
              {updates.map((update) => (
                <article key={update.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <p className="font-medium">{update.summary}</p>
                    <span className={`text-xs px-2 py-1 rounded-full border ${statusClasses[update.status]}`}>
                      {update.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                    <span>{update.repo || "repo not specified"}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="w-3 h-3" /> {new Date(update.checkpoint_at).toLocaleString()}
                    </span>
                    {update.branch && <span className="inline-flex items-center gap-1"><GitBranch className="w-3 h-3" />{update.branch}</span>}
                  </div>
                  {update.why_it_matters && <p className="text-sm text-slate-300 mt-2">Why it matters: {update.why_it_matters}</p>}
                  {update.files_touched.length > 0 && (
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                      Files: {update.files_touched.slice(0, 6).join(", ")}
                      {update.files_touched.length > 6 ? "…" : ""}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
          <h2 className="text-lg md:text-xl font-semibold">Tasks</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-3">
            {TASK_STATUSES.map((status) => (
              <div key={status} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">{status.replace("_", " ")}</p>
                <div className="space-y-2 mt-2">
                  {(groupedTasks[status] || []).map((task) => {
                    const draft = taskEdits[task.id] || task
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
                          <p>Due: {task.due_date || "Not set"}</p>
                        </div>

                        {isEditingTask && (
                          <div className="space-y-2 border-t border-slate-700 pt-2">
                            <input
                              className="w-full text-sm px-2 py-1 rounded-lg bg-slate-900 border border-slate-700"
                              value={draft.title}
                              onChange={(event) =>
                                setTaskEdits((prev) => ({
                                  ...prev,
                                  [task.id]: { ...draft, title: event.target.value },
                                }))
                              }
                            />
                            <textarea
                              className="w-full text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700"
                              rows={2}
                              value={draft.description || ""}
                              onChange={(event) =>
                                setTaskEdits((prev) => ({
                                  ...prev,
                                  [task.id]: { ...draft, description: event.target.value },
                                }))
                              }
                              placeholder="Description / notes"
                            />
                            <div className="grid grid-cols-2 gap-1">
                              <select
                                className="text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700"
                                value={draft.priority}
                                onChange={(event) =>
                                  setTaskEdits((prev) => ({
                                    ...prev,
                                    [task.id]: {
                                      ...draft,
                                      priority: event.target.value as WorkTask["priority"],
                                    },
                                  }))
                                }
                              >
                                <option value="low">low</option>
                                <option value="med">med</option>
                                <option value="high">high</option>
                              </select>
                              <select
                                className="text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700"
                                value={draft.status}
                                onChange={(event) =>
                                  setTaskEdits((prev) => ({
                                    ...prev,
                                    [task.id]: {
                                      ...draft,
                                      status: event.target.value as WorkTask["status"],
                                    },
                                  }))
                                }
                              >
                                {TASK_STATUSES.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <input
                              className="w-full text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700"
                              placeholder="Repo target"
                              value={draft.repo_target || ""}
                              onChange={(event) =>
                                setTaskEdits((prev) => ({
                                  ...prev,
                                  [task.id]: { ...draft, repo_target: event.target.value },
                                }))
                              }
                            />
                            <input
                              type="date"
                              className="w-full text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700"
                              value={draft.due_date || ""}
                              onChange={(event) =>
                                setTaskEdits((prev) => ({
                                  ...prev,
                                  [task.id]: { ...draft, due_date: event.target.value || null },
                                }))
                              }
                            />
                            <input
                              className="w-full text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700"
                              placeholder="Notes"
                              value={draft.notes || ""}
                              onChange={(event) =>
                                setTaskEdits((prev) => ({
                                  ...prev,
                                  [task.id]: { ...draft, notes: event.target.value },
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="w-full text-xs px-2 py-1 rounded-lg bg-sky-700 hover:bg-sky-600"
                              onClick={() => void saveTask(task.id).catch((err) => setError(err.message))}
                            >
                              Save
                            </button>
                          </div>
                        )}
                      </article>
                    )
                  })}
                  {(groupedTasks[status] || []).length === 0 && (
                    <div className="text-xs text-slate-500 inline-flex items-center gap-1">
                      <CircleDashed className="w-3 h-3" /> Empty
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-4">
          <button
            type="button"
            onClick={() => router.push("/usage")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to project index
          </button>
        </section>
      </div>
    </div>
  )
}
