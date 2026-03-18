import { NextResponse } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"

export async function GET() {
  try {
    const [focusRes, updatesRes, tasksRes] = await Promise.all([
      supabase.from("work_focus").select("*").eq("id", 1).maybeSingle(),
      supabase.from("work_updates").select("*").order("checkpoint_at", { ascending: false }).limit(12),
      supabase.from("work_tasks").select("*").order("created_at", { ascending: false }).limit(50),
    ])

    if (focusRes.error) throw focusRes.error
    if (updatesRes.error) throw updatesRes.error
    if (tasksRes.error) throw tasksRes.error

    return NextResponse.json({
      focus: focusRes.data,
      updates: updatesRes.data || [],
      tasks: tasksRes.data || [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load ops overview", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
