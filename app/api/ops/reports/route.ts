import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"
import { normalizeReportInput, parseProjectFilter, ReportValidationError } from "../../../../lib/server/opsReports"

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectFilter = parseProjectFilter(searchParams.get("project"))

    const limitParam = searchParams.get("limit")
    const parsedLimit = limitParam ? Number(limitParam) : DEFAULT_LIMIT
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsedLimit)))
      : DEFAULT_LIMIT

    let query = supabase.from("work_reports").select("*").order("published_at", { ascending: false }).limit(limit)

    if (projectFilter) {
      query = query.eq("project_key", projectFilter)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ reports: data || [] })
  } catch (error) {
    if (error instanceof ReportValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to load reports", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const payload = normalizeReportInput(body, { partial: false })

    const { data, error } = await supabase
      .from("work_reports")
      .insert({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json({ report: data }, { status: 201 })
  } catch (error) {
    if (error instanceof ReportValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to create report", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
