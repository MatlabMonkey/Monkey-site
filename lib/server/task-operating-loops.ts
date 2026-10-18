import { createClient } from "@supabase/supabase-js"
import {
  buildRestartSummary,
  dateInTimeZone,
  RESTART_STALE_AFTER_DAYS,
  type RestartSummary,
} from "../task-operating-loops"
import type { TaskRecord } from "../tasks"

const RESTART_QUERY_LIMIT = 200
const DAY_IN_MS = 24 * 60 * 60 * 1000

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function getRestartSummary(now = new Date()): Promise<RestartSummary> {
  const referenceDate = dateInTimeZone(
    now,
    process.env.TODO_TIME_ZONE || "America/Los_Angeles",
  )
  const staleCutoff = new Date(now.getTime() - RESTART_STALE_AFTER_DAYS * DAY_IN_MS).toISOString()
  const supabase = getSupabaseAdmin()

  const [missedResult, inboxResult, waitingResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("*", { count: "exact" })
      .in("status", ["inbox", "today", "waiting", "later"])
      .lt("due_on", referenceDate)
      .order("due_on", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(RESTART_QUERY_LIMIT),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "inbox"),
    supabase
      .from("tasks")
      .select("*", { count: "exact" })
      .eq("status", "waiting")
      .lte("updated_at", staleCutoff)
      .order("updated_at", { ascending: true })
      .limit(RESTART_QUERY_LIMIT),
  ])

  const databaseError = missedResult.error || inboxResult.error || waitingResult.error
  if (databaseError) throw new Error(databaseError.message)

  const candidates = new Map<string, TaskRecord>()
  for (const task of [...(missedResult.data || []), ...(waitingResult.data || [])] as TaskRecord[]) {
    candidates.set(task.id, task)
  }

  return buildRestartSummary(
    [...candidates.values()],
    referenceDate,
    now,
    {
      missed_commitments: missedResult.count ?? undefined,
      inbox: inboxResult.count ?? undefined,
      stale_waiting: waitingResult.count ?? undefined,
    },
  )
}
