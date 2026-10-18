import { createClient } from "@supabase/supabase-js"
import {
  generateDueDateOrganizationProposal,
  normalizeOrganizationProposal,
  normalizeOrganizationReview,
  normalizeOrganizationUuid,
  TaskOrganizationConflictError,
  TaskOrganizationNotFoundError,
  type OrganizationReviewState,
  type TaskOrganizationProposalInput,
  type TaskOrganizationProposalRecord,
  type TaskOrganizationReviewInput,
} from "../task-organization"

export type OrganizationGenerationResult = {
  reference_date: string
  evaluated_count: number
  generated_count: number
  proposals: TaskOrganizationProposalRecord[]
}

type OrganizationReviewResult = {
  outcome: "applied" | "rejected" | "superseded" | "stale"
  proposal: TaskOrganizationProposalRecord
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false } })
}

function dateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function throwOrganizationDatabaseError(error: { code?: string; message: string }): never {
  if (error.message.includes("task_organization_proposal_not_found") || error.message.includes("task_not_found")) {
    throw new TaskOrganizationNotFoundError("Task or organization proposal not found")
  }
  if (
    error.message.includes("task_version_conflict")
    || error.message.includes("task_organization_proposal_not_pending")
  ) {
    throw new TaskOrganizationConflictError("The task or proposal changed before this operation completed")
  }
  throw new Error(error.message)
}

async function transitionOrganizationProposal(
  proposalId: string,
  review: ReturnType<typeof normalizeOrganizationReview>,
): Promise<TaskOrganizationProposalRecord> {
  const { data, error } = await getSupabaseAdmin().rpc("review_task_organization_proposal", {
    p_proposal_id: proposalId,
    p_target_state: review.state,
    p_reviewer: review.reviewer,
    p_review_reason: review.reason,
  })

  if (error) throwOrganizationDatabaseError(error)
  const result = data as OrganizationReviewResult
  if (result.outcome === "stale") {
    throw new TaskOrganizationConflictError(
      "The task changed after this proposal was created; the proposal was superseded",
      result.proposal,
    )
  }
  return result.proposal
}

export async function listOrganizationProposals(
  state: OrganizationReviewState = "pending",
): Promise<TaskOrganizationProposalRecord[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("task_organization_proposals")
    .select("*, task:tasks(id, title, status, version, due_on, waiting_on)")
    .eq("state", state)
    .order("created_at", { ascending: true })
    .limit(200)

  if (error) throwOrganizationDatabaseError(error)
  return (data || []) as TaskOrganizationProposalRecord[]
}

export async function createOrganizationProposal(
  input: TaskOrganizationProposalInput,
): Promise<TaskOrganizationProposalRecord> {
  const proposal = normalizeOrganizationProposal(input)
  const { data, error } = await getSupabaseAdmin()
    .from("task_organization_proposals")
    .insert({ ...proposal, created_by: "assistant" })
    .select("*")
    .single()

  if (error) throwOrganizationDatabaseError(error)
  const created = data as TaskOrganizationProposalRecord
  if (created.boundary === "needs_review") return created

  return transitionOrganizationProposal(created.id, {
    state: "applied",
    reviewer: "assistant",
    reason: `Automatically applied safe rule ${created.rule_id}`,
  })
}

export async function generateDueDateOrganizationProposals(
  now = new Date(),
): Promise<OrganizationGenerationResult> {
  const referenceDate = dateInTimeZone(
    now,
    process.env.TODO_TIME_ZONE || "America/Los_Angeles",
  )
  const { data, error } = await getSupabaseAdmin()
    .from("tasks")
    .select("id, version, status, due_on")
    .eq("status", "inbox")
    .not("due_on", "is", null)
    .order("created_at", { ascending: true })
    .limit(200)

  if (error) throwOrganizationDatabaseError(error)

  const tasks = data || []
  const proposals: TaskOrganizationProposalRecord[] = []
  for (const task of tasks) {
    const draft = generateDueDateOrganizationProposal(task, referenceDate)
    if (draft) proposals.push(await createOrganizationProposal(draft))
  }

  return {
    reference_date: referenceDate,
    evaluated_count: tasks.length,
    generated_count: proposals.length,
    proposals,
  }
}

export async function reviewOrganizationProposal(
  proposalId: unknown,
  input: TaskOrganizationReviewInput,
): Promise<TaskOrganizationProposalRecord> {
  const id = normalizeOrganizationUuid(proposalId, "proposal_id")
  return transitionOrganizationProposal(id, normalizeOrganizationReview(input))
}
