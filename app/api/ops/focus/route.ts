import { NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      now_working_on?: string
      next_up?: string
      blocked_on?: string
      last_checkpoint_at?: string | null
    }

    const payload = {
      id: 1,
      now_working_on: body.now_working_on?.trim() || null,
      next_up: body.next_up?.trim() || null,
      blocked_on: body.blocked_on?.trim() || null,
      last_checkpoint_at: body.last_checkpoint_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from("work_focus").upsert(payload, { onConflict: "id" }).select("*").single()
    if (error) throw error

    return NextResponse.json({ focus: data })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update focus", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
