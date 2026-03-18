import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../../lib/supabaseClient"

const TASK_STATUSES = ["inbox", "planned", "in_progress", "review", "done"] as const
const PRIORITIES = ["low", "med", "high"] as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as {
      status?: string
      priority?: string
      title?: string
      description?: string
      repo_target?: string
      due_date?: string | null
      notes?: string
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.status !== undefined) {
      if (!TASK_STATUSES.includes(body.status as (typeof TASK_STATUSES)[number])) {
        return NextResponse.json({ error: "invalid status" }, { status: 400 })
      }
      updates.status = body.status
      updates.completed_at = body.status === "done" ? new Date().toISOString() : null
    }

    if (body.priority !== undefined) {
      if (!PRIORITIES.includes(body.priority as (typeof PRIORITIES)[number])) {
        return NextResponse.json({ error: "invalid priority" }, { status: 400 })
      }
      updates.priority = body.priority
    }

    if (body.title !== undefined) updates.title = body.title.trim()
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.repo_target !== undefined) updates.repo_target = body.repo_target?.trim() || null
    if (body.due_date !== undefined) updates.due_date = body.due_date || null
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null

    const { data, error } = await supabase.from("work_tasks").update(updates).eq("id", id).select("*").single()
    if (error) throw error

    return NextResponse.json({ task: data })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update task", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
