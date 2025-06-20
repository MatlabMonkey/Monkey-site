import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { completed } = body
    const { id } = await context.params

    const { data: todo, error } = await supabase
      .from("todos")
      .update({
        completed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "Failed to update todo" }, { status: 500 })
    }

    return NextResponse.json({ todo })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const { error } = await supabase.from("todos").delete().eq("id", id)

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "Failed to delete todo" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
