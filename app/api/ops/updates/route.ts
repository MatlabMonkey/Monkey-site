import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"

const VALID_STATUSES = ["in_progress", "needs_review", "blocked", "shipped"] as const

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      summary?: string
      repo?: string
      branch?: string
      commit_start?: string
      commit_end?: string
      commit_url?: string
      pr_url?: string
      files_touched?: string[]
      why_it_matters?: string
      status?: string
    }

    if (!body.summary?.trim()) {
      return NextResponse.json({ error: "summary is required" }, { status: 400 })
    }

    if (!body.repo?.trim()) {
      return NextResponse.json({ error: "repo is required" }, { status: 400 })
    }

    const status = body.status || "in_progress"
    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 })
    }

    const filesTouched = Array.isArray(body.files_touched)
      ? body.files_touched.map((item) => item.trim()).filter(Boolean).slice(0, 10)
      : []

    const { data, error } = await supabase
      .from("work_updates")
      .insert({
        summary: body.summary.trim(),
        repo: body.repo.trim(),
        branch: body.branch?.trim() || "main",
        commit_start: body.commit_start?.trim() || null,
        commit_end: body.commit_end?.trim() || null,
        commit_url: body.commit_url?.trim() || null,
        pr_url: body.pr_url?.trim() || null,
        files_touched: filesTouched,
        why_it_matters: body.why_it_matters?.trim() || null,
        status,
        checkpoint_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json({ update: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create work update", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
