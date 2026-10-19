"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, Check, Clock3, Loader2, ShieldAlert } from "lucide-react"
import type {
  CaseDependencyRecord,
  CaseEscalationRecord,
  CaseEventRecord,
  CaseEvidenceRecord,
  CaseStatus,
  TrackedCaseRecord,
  TrackedCaseTaskRecord,
} from "../../lib/tracked-cases"
import type { TaskRecord } from "../../lib/tasks"

type TrackedCaseDetail = {
  case: TrackedCaseRecord
  tasks: Array<TrackedCaseTaskRecord & { task: TaskRecord }>
  dependencies: CaseDependencyRecord[]
  evidence: CaseEvidenceRecord[]
  escalations: CaseEscalationRecord[]
  events: CaseEventRecord[]
}

const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  active: "Active",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase())
}

function formatMoment(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatDay(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function TrackedCasesPanel() {
  const [cases, setCases] = useState<TrackedCaseRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TrackedCaseDetail | null>(null)
  const [loadingCases, setLoadingCases] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const loadCases = useCallback(async () => {
    setLoadingCases(true)
    setError("")
    try {
      const response = await fetch("/api/tracked-cases", { cache: "no-store" })
      const data = (await response.json()) as { cases?: TrackedCaseRecord[]; error?: string }
      if (!response.ok) throw new Error(data.error || "Unable to load tracked cases")
      const nextCases = data.cases || []
      setCases(nextCases)
      setSelectedId((current) => current && nextCases.some((item) => item.id === current)
        ? current
        : nextCases[0]?.id || null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load tracked cases")
    } finally {
      setLoadingCases(false)
    }
  }, [])

  const loadDetail = useCallback(async (caseId: string) => {
    setLoadingDetail(true)
    setError("")
    try {
      const response = await fetch(`/api/tracked-cases/${caseId}`, { cache: "no-store" })
      const data = (await response.json()) as TrackedCaseDetail & { error?: string }
      if (!response.ok) throw new Error(data.error || "Unable to load tracked case")
      setDetail(data)
    } catch (loadError) {
      setDetail(null)
      setError(loadError instanceof Error ? loadError.message : "Unable to load tracked case")
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    void loadCases()
  }, [loadCases])

  useEffect(() => {
    setReviewNote("")
    setNotice("")
    if (selectedId) void loadDetail(selectedId)
    else setDetail(null)
  }, [loadDetail, selectedId])

  const refresh = useCallback(async () => {
    if (!selectedId) return
    await Promise.all([loadCases(), loadDetail(selectedId)])
  }, [loadCases, loadDetail, selectedId])

  const patchResource = async (key: string, endpoint: string, body: Record<string, unknown>, success: string) => {
    if (!reviewNote.trim()) return
    setUpdatingKey(key)
    setError("")
    setNotice("")
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, reason: reviewNote }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Unable to apply review action")
      setReviewNote("")
      setNotice(success)
      await refresh()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to apply review action")
    } finally {
      setUpdatingKey(null)
    }
  }

  const taskNames = useMemo(
    () => new Map(detail?.tasks.map(({ task }) => [task.id, task.title]) || []),
    [detail],
  )
  const openEscalations = detail?.escalations.filter((item) => item.state !== "resolved") || []

  if (loadingCases) return <LoadingState label="Loading tracked cases" />

  if (cases.length === 0 && !error) {
    return (
      <div className="rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-6 py-12 text-center">
        <p className="font-medium">No tracked cases yet.</p>
        <p className="mt-2 text-sm text-[rgb(var(--text-muted))]">Outcome-driven work will appear here with its evidence and history.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,2.2fr)]">
      <aside aria-label="Tracked cases" className="space-y-3">
        {cases.map((trackedCase) => {
          const selected = trackedCase.id === selectedId
          return (
            <button
              key={trackedCase.id}
              type="button"
              onClick={() => setSelectedId(trackedCase.id)}
              aria-pressed={selected}
              className={`w-full rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand)_/_0.5)] ${selected ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak))]" : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:border-[rgb(var(--brand)_/_0.6)]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium leading-snug">{trackedCase.title}</span>
                <span className="shrink-0 rounded-full border border-[rgb(var(--border))] px-2 py-1 text-xs text-[rgb(var(--text-muted))]">{CASE_STATUS_LABELS[trackedCase.status]}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[rgb(var(--text-muted))]">{trackedCase.outcome}</p>
              <p className="mt-3 font-mono text-xs text-[rgb(var(--text-muted))]">Updated {formatMoment(trackedCase.updated_at)}</p>
            </button>
          )
        })}
      </aside>

      <div className="min-w-0">
        {error && <div className="mb-4 rounded-2xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200" role="alert">{error}</div>}
        {notice && <div className="mb-4 rounded-2xl border border-green-400/40 bg-green-400/10 p-4 text-sm text-green-200" role="status">{notice}</div>}
        {loadingDetail ? <LoadingState label="Loading tracked case detail" /> : detail ? (
          <div className="space-y-6">
            <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 sm:p-6" aria-labelledby="case-detail-heading">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--brand))]">Desired outcome</p>
                  <h3 id="case-detail-heading" className="mt-2 text-2xl font-semibold">{detail.case.title}</h3>
                  <p className="mt-3 leading-relaxed text-[rgb(var(--text-muted))]">{detail.case.outcome}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-1.5">{CASE_STATUS_LABELS[detail.case.status]}</span>
                  <span className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-1.5 text-[rgb(var(--text-muted))]">{label(detail.case.automation_state)}</span>
                  <span className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-1.5 font-mono text-[rgb(var(--text-muted))]">v{detail.case.version}</span>
                </div>
              </div>
              {detail.case.deadline_on ? (
                <dl className="mt-5 grid gap-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4 sm:grid-cols-3">
                  <Metric label="Deadline" value={formatDay(detail.case.deadline_on)} />
                  <Metric label="Provenance" value={`${label(detail.case.deadline_provenance_type || "unknown")} · ${detail.case.deadline_provenance_ref}`} />
                  <Metric label="Confidence" value={`${Math.round((detail.case.deadline_confidence || 0) * 100)}%`} mono />
                </dl>
              ) : <p className="mt-5 text-sm text-[rgb(var(--text-muted))]">No deadline is recorded.</p>}
            </section>

            <section className="rounded-2xl border border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak))] p-4 sm:p-5" aria-labelledby="case-actions-heading">
              <h3 id="case-actions-heading" className="text-xl font-semibold">Review actions</h3>
              <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">Every change needs a note and is preserved in case history.</p>
              <label htmlFor="case-review-note" className="mt-4 block text-sm font-medium">Review note</label>
              <textarea
                id="case-review-note"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Why are you making this change?"
                rows={2}
                maxLength={2000}
                className="mt-2 w-full resize-y rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--brand))] focus:ring-2 focus:ring-[rgb(var(--brand)_/_0.2)]"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {(["active", "blocked", "completed", "cancelled"] as CaseStatus[]).filter((status) => status !== detail.case.status).map((status) => (
                  <ActionButton
                    key={status}
                    label={`Mark ${CASE_STATUS_LABELS[status].toLowerCase()}`}
                    busy={updatingKey === `case-${status}`}
                    disabled={!reviewNote.trim() || updatingKey !== null}
                    onClick={() => void patchResource(`case-${status}`, `/api/tracked-cases/${detail.case.id}`, { expected_version: detail.case.version, status }, `Case marked ${CASE_STATUS_LABELS[status].toLowerCase()}.`)}
                  />
                ))}
              </div>
            </section>

            <CaseSection id="exceptions-heading" title="Exceptions" count={openEscalations.length} empty="No open exceptions need attention." emphasized={openEscalations.length > 0}>
              {openEscalations.map((escalation) => (
                <article key={escalation.id} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-amber-300" />
                        <span className="font-medium">{label(escalation.severity)} exception</span>
                        <span className="text-xs text-amber-200">{label(escalation.state)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--text-muted))]">{escalation.reason}</p>
                      <p className="mt-2 font-mono text-xs text-[rgb(var(--text-muted))]">Opened {formatMoment(escalation.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {escalation.state === "open" && <ActionButton label="Acknowledge" busy={updatingKey === `escalation-${escalation.id}-acknowledged`} disabled={!reviewNote.trim() || updatingKey !== null} onClick={() => void patchResource(`escalation-${escalation.id}-acknowledged`, `/api/tracked-cases/${detail.case.id}/escalations/${escalation.id}`, { state: "acknowledged" }, "Exception acknowledged.")} />}
                      <ActionButton label="Resolve" busy={updatingKey === `escalation-${escalation.id}-resolved`} disabled={!reviewNote.trim() || updatingKey !== null} onClick={() => void patchResource(`escalation-${escalation.id}-resolved`, `/api/tracked-cases/${detail.case.id}/escalations/${escalation.id}`, { state: "resolved" }, "Exception resolved.")} />
                    </div>
                  </div>
                </article>
              ))}
            </CaseSection>

            <CaseSection id="dependencies-heading" title="Dependencies" count={detail.dependencies.length} empty="No dependencies are recorded.">
              {detail.dependencies.map((dependency) => (
                <article key={dependency.id} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span>{taskNames.get(dependency.blocked_task_id) || "Unavailable task"}</span>
                        <ArrowRight className="h-4 w-4 text-[rgb(var(--brand))]" />
                        <span>{taskNames.get(dependency.blocking_task_id) || "Unavailable task"}</span>
                      </div>
                      <p className="mt-2 text-sm text-[rgb(var(--text-muted))]">{dependency.rationale}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[rgb(var(--border))] px-2 py-1 text-xs text-[rgb(var(--text-muted))]">{label(dependency.state)}</span>
                  </div>
                  {dependency.state === "open" && <div className="mt-3 flex flex-wrap gap-2">
                    {(["satisfied", "waived"] as const).map((state) => (
                      <ActionButton key={state} label={state === "satisfied" ? "Mark satisfied" : "Waive"} busy={updatingKey === `dependency-${dependency.id}-${state}`} disabled={!reviewNote.trim() || updatingKey !== null} onClick={() => void patchResource(`dependency-${dependency.id}-${state}`, `/api/tracked-cases/${detail.case.id}/dependencies/${dependency.id}`, { state }, `Dependency marked ${state}.`)} />
                    ))}
                  </div>}
                </article>
              ))}
            </CaseSection>

            <CaseSection id="linked-work-heading" title="Linked work" count={detail.tasks.length} empty="No tasks are attached to this case.">
              {detail.tasks.map(({ task, role }) => (
                <article key={task.id} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="font-medium">{task.title}</p>{task.waiting_on && <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">Waiting on {task.waiting_on}</p>}</div>
                    <div className="flex shrink-0 gap-2 text-xs text-[rgb(var(--text-muted))]"><span className="rounded-full border border-[rgb(var(--border))] px-2 py-1">{label(role)}</span><span className="rounded-full border border-[rgb(var(--border))] px-2 py-1">{label(task.status)}</span></div>
                  </div>
                </article>
              ))}
            </CaseSection>

            <CaseSection id="evidence-heading" title="Evidence" count={detail.evidence.length} empty="No evidence has been recorded.">
              {detail.evidence.map((evidence) => (
                <article key={evidence.id} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="font-medium">{evidence.summary}</p><p className="mt-2 text-sm text-[rgb(var(--text-muted))]">{label(evidence.evidence_type)} from {evidence.source} · {label(evidence.reconciliation_action)}</p><p className="mt-1 font-mono text-xs text-[rgb(var(--text-muted))]">Rule {evidence.reconciliation_rule} · Source ID {evidence.source_id}</p></div>
                    <time className="shrink-0 font-mono text-xs text-[rgb(var(--text-muted))]" dateTime={evidence.observed_at}>{formatMoment(evidence.observed_at)}</time>
                  </div>
                </article>
              ))}
            </CaseSection>

            <CaseSection id="case-history-heading" title="Case history" count={detail.events.length} empty="No case history is available.">
              {detail.events.map((event) => (
                <article key={event.id} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="font-medium">{label(event.event_type)}</p><p className="mt-1 text-sm text-[rgb(var(--text-muted))]">{label(event.entity_type)} · {event.actor}{event.reason ? ` · ${event.reason}` : ""}</p></div>
                    <time className="shrink-0 font-mono text-xs text-[rgb(var(--text-muted))]" dateTime={event.created_at}>{formatMoment(event.created_at)}</time>
                  </div>
                </article>
              ))}
            </CaseSection>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function LoadingState({ label: loadingLabel }: { label: string }) {
  return <div className="flex min-h-40 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"><Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--brand))]" aria-label={loadingLabel} /></div>
}

function Metric({ label: metricLabel, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">{metricLabel}</dt><dd className={`mt-1 break-words text-sm ${mono ? "font-mono" : ""}`}>{value}</dd></div>
}

function CaseSection({ id, title, count, empty, emphasized = false, children }: { id: string; title: string; count: number; empty: string; emphasized?: boolean; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={`rounded-2xl border p-4 sm:p-5 ${emphasized ? "border-amber-500/40 bg-amber-500/5" : "border-[rgb(var(--border))] bg-[rgb(var(--surface))]"}`}>
      <div className="flex items-center justify-between gap-4"><h3 id={id} className="text-xl font-semibold">{title}</h3><span className="font-mono text-sm text-[rgb(var(--text-muted))]">{count}</span></div>
      {count === 0 ? <p className="mt-4 text-sm text-[rgb(var(--text-muted))]">{empty}</p> : <div className="mt-4 space-y-3">{children}</div>}
    </section>
  )
}

function ActionButton({ label: actionLabel, busy, disabled, onClick }: { label: string; busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm text-[rgb(var(--text-muted))] transition hover:border-[rgb(var(--brand))] hover:text-[rgb(var(--text))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand)_/_0.5)] disabled:cursor-not-allowed disabled:opacity-50">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : actionLabel.includes("Resolve") || actionLabel.includes("satisfied") ? <Check className="h-4 w-4" /> : actionLabel.includes("blocked") ? <AlertTriangle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}{actionLabel}
    </button>
  )
}
