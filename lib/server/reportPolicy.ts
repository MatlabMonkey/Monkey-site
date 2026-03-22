export const REPORT_POLICY_ELIGIBLE_STATUSES = ["shipped", "needs_review"] as const

export type ReportPolicyEligibleStatus = (typeof REPORT_POLICY_ELIGIBLE_STATUSES)[number]

export type ReportPolicyInput = {
  status: string
  hasCommitRange: boolean
  filesTouchedCount: number
  hasProjectKey: boolean
  hoursSinceLastRunLog: number | null
}

export type ReportPolicyDecision = {
  shouldCreateDraft: boolean
  confidence: number
  reasons: string[]
}

export type CandidateUpdateInput = {
  id: string
  project_key: string | null
  status: string
  summary: string
  commit_start: string | null
  commit_end: string | null
  files_touched: string[]
  checkpoint_at: string
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeFilesTouchedCount(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

function isEligibleStatus(status: string): status is ReportPolicyEligibleStatus {
  return REPORT_POLICY_ELIGIBLE_STATUSES.includes(status as ReportPolicyEligibleStatus)
}

export function scoreRunLogDraftPolicy(input: ReportPolicyInput): ReportPolicyDecision {
  const reasons: string[] = []

  const status = input.status.trim().toLowerCase()
  const hasProjectKey = Boolean(input.hasProjectKey)
  const filesTouchedCount = normalizeFilesTouchedCount(input.filesTouchedCount)

  let confidence = 0

  if (status === "shipped") {
    confidence += 45
    reasons.push("Update status is shipped")
  } else if (status === "needs_review") {
    confidence += 32
    reasons.push("Update status is needs_review")
  } else {
    reasons.push(`Status '${status || "unknown"}' is outside auto-draft policy`)
  }

  if (input.hasCommitRange) {
    confidence += 15
    reasons.push("Commit range is present")
  }

  if (filesTouchedCount >= 12) {
    confidence += 18
    reasons.push(`Large change set (${filesTouchedCount} files touched)`)
  } else if (filesTouchedCount >= 6) {
    confidence += 12
    reasons.push(`Medium change set (${filesTouchedCount} files touched)`)
  } else if (filesTouchedCount >= 1) {
    confidence += 6
    reasons.push(`Small change set (${filesTouchedCount} files touched)`)
  } else {
    reasons.push("No files_touched metadata attached")
  }

  if (hasProjectKey) {
    confidence += 12
    reasons.push("project_key is present")
  } else {
    confidence -= 25
    reasons.push("project_key missing (auto-draft blocked)")
  }

  if (input.hoursSinceLastRunLog === null) {
    confidence += 18
    reasons.push("No prior run log found for project")
  } else if (input.hoursSinceLastRunLog >= 72) {
    confidence += 20
    reasons.push(`Last run log is stale (${Math.floor(input.hoursSinceLastRunLog)}h ago)`)
  } else if (input.hoursSinceLastRunLog >= 24) {
    confidence += 12
    reasons.push(`Last run log older than 24h (${Math.floor(input.hoursSinceLastRunLog)}h ago)`)
  } else if (input.hoursSinceLastRunLog >= 8) {
    confidence += 5
    reasons.push(`Last run log older than 8h (${Math.floor(input.hoursSinceLastRunLog)}h ago)`)
  } else {
    confidence -= 8
    reasons.push(`Recent run log already exists (${Math.max(0, Math.floor(input.hoursSinceLastRunLog))}h ago)`)
  }

  const boundedConfidence = clampConfidence(confidence)
  const shouldCreateDraft = isEligibleStatus(status) && hasProjectKey && boundedConfidence >= 60

  return {
    shouldCreateDraft,
    confidence: boundedConfidence,
    reasons,
  }
}

export function evaluateUpdateAsRunLogCandidate(
  update: CandidateUpdateInput,
  options?: {
    lastRunDate?: string | null
    now?: Date
  },
): ReportPolicyDecision {
  const now = options?.now || new Date()
  const lastRunDate = options?.lastRunDate ? new Date(options.lastRunDate) : null
  const hoursSinceLastRunLog =
    lastRunDate && !Number.isNaN(lastRunDate.getTime())
      ? (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60)
      : null

  return scoreRunLogDraftPolicy({
    status: update.status,
    hasCommitRange: Boolean(update.commit_start && update.commit_end),
    filesTouchedCount: update.files_touched.length,
    hasProjectKey: Boolean(update.project_key),
    hoursSinceLastRunLog,
  })
}
