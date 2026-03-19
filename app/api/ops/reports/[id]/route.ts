import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../../lib/supabaseClient"
import { normalizeReportInput, ReportValidationError } from "../../../../../lib/server/opsReports"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>

    const updates = {
      ...normalizeReportInput(body, { partial: true }),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from("work_reports").update(updates).eq("id", id).select("*").single()

    if (error) throw error

    return NextResponse.json({ report: data })
  } catch (error) {
    if (error instanceof ReportValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Failed to update report", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { error } = await supabase.from("work_reports").delete().eq("id", id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete report", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
