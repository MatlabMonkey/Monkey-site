"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown, ChevronUp, CircleDashed, Clock3, ExternalLink, Save } from "lucide-react"
import PinGate from "../components/PinGate"

type Focus = {
  now_working_on: string | null
  next_up: string | null
  blocked_on: string | null
  last_checkpoint_at: string | null
}

type WorkUpdate = {
  id: string
  summary: string
  repo: string | null
  branch: string | null
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
  artifact_path: string | null
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

export default function UsageOpsDashboardPage() {
  const [focus, setFocus] = useState<Focus | null>(null)
  const [updates, setUpdates] = useState<WorkUpdate[]>([])
  const [tasks, setTasks] = useState<WorkTask[]>([])
  const [reports, setReports] = useState<WorkReport[]>([])
  const [github, setGithub] = useState<GitHubData | null>(null)
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
    priority: "med",
    repo_target: "",
    due_date: "",
    notes: "",
  })

  const [taskEdits, setTaskEdits] = useState<Record<string, WorkTask>>({})

  const [showPublishPanel, setShowPublishPanel] = useState(false)
  const [isPublishingReport, setIsPublishingReport] = useState(false)
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("all")
  const [reportDraft, setReportDraft] = useState({
    project_key: "",
    project_label: "",
    title: "",
    summary: "",
    report_type: "html" as WorkReport["report_type"],
    report_url: "",
    artifact_path: "",
    commit_ref: "",
    tags: "",
    published_by: "agent",
  })

  const groupedTasks = useMemo(() => {
    return TASK_STATUSES.reduce(
      (acc, status) => {
        acc[status] = tasks.filter((task) => task.status === status)
        return acc
      },
      {} as Record<WorkTask["status"], WorkTask[]>,
    )
  }, [tasks])

  const projectOptions = useMemo(() => {
    const projects = new Map<string, string>()

    for (const report of reports) {
      const projectKey = report.project_key
      const projectLabel = report.project_label?.trim() || report.project_key
      if (!projects.has(projectKey)) {
        projects.set(projectKey, projectLabel)
      }
    }

    return Array.from(projects.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [reports])

  const groupedReports = useMemo(() => {
    const visibleReports = reports.filter((report) => {
      if (selectedProjectFilter === "all") return true
      return report.project_key === selectedProjectFilter
    })

    const grouped = new Map<string, WorkReport[]>()

    for (const report of visibleReports) {
      const groupLabel = report.project_label?.trim() || report.project_key
      const existing = grouped.get(groupLabel) || []
      existing.push(report)
      grouped.set(groupLabel, existing)
    }

    return Array.from(grouped.entries())
      .map(([projectLabel, items]) => ({
        projectLabel,
        reports: items.sort(
          (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
        ),
      }))
      .sort((a, b) => a.projectLabel.localeCompare(b.projectLabel))
  }, [reports, selectedProjectFilter])

  async function loadAll() {
    setError("")
    setLoading(true)
    try {
      const [overviewRes, githubRes] = await Promise.all([
        fetch("/api/ops/overview", { cache: "no-store" }),
        fetch("/api/ops/github", { cache: "no-store" }),
      ])

      const overviewJson = await overviewRes.json()
      if (!overviewRes.ok) throw new Error(overviewJson.error || "Failed to load dashboard")

      setFocus(overviewJson.focus)
      setUpdates(overviewJson.updates || [])
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

      const githubJson = await githubRes.json()
      setGithub(githubJson)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ops dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  async function saveFocus() {
    const response = await fetch("/api/ops/focus", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(focusDraft),
    })
    const json = await response.json()
    if (!response.ok) throw new Error(json.error || "Failed to save focus")
    setFocus(json.focus)
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

  async function createTask(event: React.FormEvent) {
    event.preventDefault()
    const response = await fetch("/api/ops/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskDraft),
    })
    const json = await response.json()
    if (!response.ok) throw new Error(json.error || "Failed to create task")

    setTaskDraft({ title: "", description: "", priority: "med", repo_target: "", due_date: "", notes: "" })
    await loadAll()
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
        due_date: draft.due_date,
        notes: draft.notes,
        status: draft.status,
      }),
    })
    const json = await response.json()
    if (!response.ok) throw new Error(json.error || "Failed to update task")
    await loadAll()
  }

  async function publishReport(event: React.FormEvent) {
    event.preventDefault()

    setError("")
    setIsPublishingReport(true)

    try {
      const response = await fetch("/api/ops/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_key: reportDraft.project_key,
          project_label: reportDraft.project_label,
          title: reportDraft.title,
          summary: reportDraft.summary,
          report_type: reportDraft.report_type,
          report_url: reportDraft.report_url,
          artifact_path: reportDraft.artifact_path,
          commit_ref: reportDraft.commit_ref,
          tags: parseTags(reportDraft.tags),
          published_by: reportDraft.published_by,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || "Failed to publish report")
      }

      setReportDraft((prev) => ({
        ...prev,
        title: "",
        summary: "",
        report_url: "",
        artifact_path: "",
        commit_ref: "",
        tags: "",
      }))

      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish report")
    } finally {
      setIsPublishingReport(false)
    }
  }

  if (loading) {
    return (
      <PinGate>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-sky-400 mx-auto" />
            <p className="mt-3 text-slate-300">Loading ops dashboard...</p>
          </div>
        </div>
      </PinGate>
    )
  }

  return (
    <PinGate>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
          <header className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
              <ArrowLeft className="w-4 h-4" />
              Back home
            </Link>
            <h1 className="text-2xl md:text-4xl font-bold mt-2">Ops Dashboard</h1>
            <p className="text-slate-400 mt-1 text-sm md:text-base">Current focus, agent checkpoints, requests from Zach, and read-only GitHub visibility.</p>
          </header>

          {error && (
            <div className="rounded-xl border border-red-800 bg-red-900/30 p-3 text-red-200 text-sm">{error}</div>
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

          <section className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-3">
              <h2 className="text-lg md:text-xl font-semibold">Work Feed (agent checkpoints)</h2>
              <p className="text-sm text-slate-400">This feed is read-only on the dashboard. Checkpoints are posted by agent automation.</p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6">
              <h2 className="text-lg md:text-xl font-semibold mb-2">GitHub (read-only)</h2>
              {!github?.configured ? (
                <p className="text-sm text-slate-400">{github?.hint || "GitHub not configured."}</p>
              ) : github.error ? (
                <p className="text-sm text-amber-200">{github.error}</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase text-slate-400 mb-2">Recent commits</p>
                    <div className="space-y-2">
                      {github.commits.map((commit) => (
                        <a key={commit.sha} href={commit.html_url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-800 p-3 hover:bg-slate-800/60">
                          <p className="text-sm line-clamp-2">{commit.message}</p>
                          <p className="text-xs text-slate-400 mt-1">{commit.sha.slice(0, 7)} · {commit.author}</p>
                        </a>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400 mb-2">Open PRs</p>
                    <div className="space-y-2">
                      {github.pullRequests.map((pr) => (
                        <a key={pr.id} href={pr.html_url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-800 p-3 hover:bg-slate-800/60">
                          <p className="text-sm">#{pr.number} {pr.title}</p>
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

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-4">Work Feed</h2>
            {updates.length === 0 ? (
              <p className="text-sm text-slate-400">No checkpoints yet.</p>
            ) : (
              <div className="space-y-3">
                {updates.map((update) => (
                  <article key={update.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <p className="font-medium">{update.summary}</p>
                      <span className={`text-xs px-2 py-1 rounded-full border ${statusClasses[update.status]}`}>{update.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                      <span>{update.repo || "repo not specified"}</span>
                      <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /> {new Date(update.checkpoint_at).toLocaleString()}</span>
                    </div>
                    {update.why_it_matters && <p className="text-sm text-slate-300 mt-2">Why it matters: {update.why_it_matters}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-semibold">Published Reports</h2>
                <p className="text-sm text-slate-400 mt-1">Read-only by default. Browse by project, then expand the agent panel only when you need to publish a new report.</p>
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

            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="project-filter" className="text-xs uppercase tracking-wide text-slate-400">Project</label>
              <select
                id="project-filter"
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm"
                value={selectedProjectFilter}
                onChange={(e) => setSelectedProjectFilter(e.target.value)}
              >
                <option value="all">All projects</option>
                {projectOptions.map((project) => (
                  <option key={project.key} value={project.key}>{project.label}</option>
                ))}
              </select>
            </div>

            {showPublishPanel && (
              <form onSubmit={(event) => void publishReport(event)} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 grid md:grid-cols-2 gap-2">
                <input
                  required
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                  placeholder="Project key (e.g. monkey-site)"
                  value={reportDraft.project_key}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, project_key: e.target.value }))}
                />
                <input
                  required
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                  placeholder="Project label"
                  value={reportDraft.project_label}
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
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700"
                  placeholder="Published by"
                  value={reportDraft.published_by}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, published_by: e.target.value }))}
                />
                <input
                  required
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2"
                  placeholder="Report URL"
                  value={reportDraft.report_url}
                  onChange={(e) => setReportDraft((prev) => ({ ...prev, report_url: e.target.value }))}
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

            {groupedReports.length === 0 ? (
              <p className="text-sm text-slate-400">No published reports yet.</p>
            ) : (
              <div className="space-y-4">
                {groupedReports.map((group) => (
                  <div key={group.projectLabel} className="space-y-2">
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
                                <span key={`${report.id}-${tag}`} className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-800 text-slate-300">#{tag}</span>
                              ))}
                            </div>
                          )}
                          <a
                            href={report.report_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
                          >
                            Open report <ExternalLink className="w-4 h-4" />
                          </a>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-4">
            <h2 className="text-lg md:text-xl font-semibold">Task Inbox (requests from Zach)</h2>
            <form onSubmit={(event) => void createTask(event).catch((err) => setError(err.message))} className="grid md:grid-cols-2 gap-2">
              <input required className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2" placeholder="Title" value={taskDraft.title} onChange={(e) => setTaskDraft((p) => ({ ...p, title: e.target.value }))} />
              <textarea className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 md:col-span-2" rows={2} placeholder="Description / notes" value={taskDraft.description} onChange={(e) => setTaskDraft((p) => ({ ...p, description: e.target.value }))} />
              <select className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700" value={taskDraft.priority} onChange={(e) => setTaskDraft((p) => ({ ...p, priority: e.target.value }))}>
                <option value="low">low</option>
                <option value="med">med</option>
                <option value="high">high</option>
              </select>
              <input className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700" placeholder="Repo target" value={taskDraft.repo_target} onChange={(e) => setTaskDraft((p) => ({ ...p, repo_target: e.target.value }))} />
              <input type="date" className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700" value={taskDraft.due_date} onChange={(e) => setTaskDraft((p) => ({ ...p, due_date: e.target.value }))} />
              <input className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700" placeholder="Extra notes" value={taskDraft.notes} onChange={(e) => setTaskDraft((p) => ({ ...p, notes: e.target.value }))} />
              <button className="md:col-span-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500">Create request</button>
            </form>

            <div className="grid lg:grid-cols-5 gap-3">
              {TASK_STATUSES.map((status) => (
                <div key={status} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">{status.replace("_", " ")}</p>
                  <div className="space-y-2 mt-2">
                    {(groupedTasks[status] || []).map((task) => {
                      const draft = taskEdits[task.id] || task
                      return (
                        <article key={task.id} className="rounded-xl border border-slate-700 p-2 bg-slate-800/70 space-y-2">
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
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>
                          <input className="w-full text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" placeholder="Repo target" value={draft.repo_target || ""} onChange={(e) => setTaskEdits((prev) => ({ ...prev, [task.id]: { ...draft, repo_target: e.target.value } }))} />
                          <input type="date" className="w-full text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" value={draft.due_date || ""} onChange={(e) => setTaskEdits((prev) => ({ ...prev, [task.id]: { ...draft, due_date: e.target.value || null } }))} />
                          <input className="w-full text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-700" placeholder="Notes" value={draft.notes || ""} onChange={(e) => setTaskEdits((prev) => ({ ...prev, [task.id]: { ...draft, notes: e.target.value } }))} />
                          <button type="button" className="w-full text-xs px-2 py-1 rounded-lg bg-sky-700 hover:bg-sky-600" onClick={() => void saveTask(task.id).catch((err) => setError(err.message))}>Save</button>
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
        </div>
      </div>
    </PinGate>
  )
}
