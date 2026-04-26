import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabase } from "../../../../lib/supabaseClient"

const RESPONSE_PIN = "2245"

function getDbClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    : supabase
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await request.json()

    if (body.pin !== RESPONSE_PIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const responseText = typeof body.response === "string" ? body.response.trim() : ""
    if (!responseText) {
      return NextResponse.json({ error: "Response is required" }, { status: 400 })
    }

    const dbClient = getDbClient()

    const { data: question, error } = await dbClient
      .from("questions")
      .update({
        response: responseText,
        responded_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        { error: "Failed to update question", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ question })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as { pin?: string }

    if (body.pin !== RESPONSE_PIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const dbClient = getDbClient()
    const { error } = await dbClient.from("questions").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete question", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
