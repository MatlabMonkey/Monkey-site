import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"

const TASK_STATUSES = ["inbox", "planned", "in_progress", "review", "done"] as const
const PRIORITIES = ["low", "med", "high"] as const

export async function GET() {
  try {
    const { data, error } = await supabase.from("work_tasks").select("*").order("created_at", { ascending: false }).limit(100)
    if (error) throw error

    return NextResponse.json({ tasks: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load tasks", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title?: string
      description?: string
      priority?: string
      repo_target?: string
      due_date?: string
      notes?: string
      status?: string
    }

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    const priority = body.priority || "med"
    if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) {
      return NextResponse.json({ error: "invalid priority" }, { status: 400 })
    }

    const status = body.status || "inbox"
    if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("work_tasks")
      .insert({
        title: body.title.trim(),
        description: body.description?.trim() || null,
        priority,
        status,
        repo_target: body.repo_target?.trim() || null,
        due_date: body.due_date || null,
        notes: body.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json({ task: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create task", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
