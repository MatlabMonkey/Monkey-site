import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

type JsonMap = Record<string, unknown>

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

function normalizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
}

function normalizeBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value
  return undefined
}

export async function GET(request: NextRequest) {
  try {
    const showArchived = request.nextUrl.searchParams.get("archived") === "true"
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") || "100")
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100

    const supabase = getSupabaseAdmin()
    const query = supabase
      .from("ideas")
      .select("*")
      .eq("archived", showArchived)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit)

    const { data: ideas, error } = await query
    if (error) {
      console.error("Supabase ideas fetch error:", error)
      return NextResponse.json({ error: "Failed to fetch ideas", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ ideas: ideas || [] })
  } catch (error) {
    console.error("Ideas GET API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as JsonMap
    const content = typeof body.content === "string" ? body.content.trim() : ""

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "manual"
    const tags = normalizeTags(body.tags) || []
    const pinned = normalizeBool(body.pinned) || false
    const archived = normalizeBool(body.archived) || false
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {}

    const supabase = getSupabaseAdmin()
    const { data: idea, error } = await supabase
      .from("ideas")
      .insert([{ content, source, tags, pinned, archived, metadata }])
      .select()
      .single()

    if (error) {
      console.error("Supabase ideas insert error:", error)
      return NextResponse.json({ error: "Failed to create idea", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ idea }, { status: 201 })
  } catch (error) {
    console.error("Ideas POST API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as JsonMap
    const id = typeof body.id === "string" ? body.id : ""

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (typeof body.content === "string") {
      const content = body.content.trim()
      if (!content) {
        return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 })
      }
      updates.content = content
    }

    const tags = normalizeTags(body.tags)
    if (tags) updates.tags = tags

    const pinned = normalizeBool(body.pinned)
    if (typeof pinned === "boolean") updates.pinned = pinned

    const archived = normalizeBool(body.archived)
    if (typeof archived === "boolean") updates.archived = archived

    if (body.metadata && typeof body.metadata === "object") {
      updates.metadata = body.metadata
    }

    const supabase = getSupabaseAdmin()
    const { data: idea, error } = await supabase.from("ideas").update(updates).eq("id", id).select().single()

    if (error) {
      console.error("Supabase ideas update error:", error)
      return NextResponse.json({ error: "Failed to update idea", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ idea })
  } catch (error) {
    console.error("Ideas PATCH API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let id = request.nextUrl.searchParams.get("id") || ""
    if (!id) {
      const body = (await request.json().catch(() => ({}))) as JsonMap
      id = typeof body.id === "string" ? body.id : ""
    }

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from("ideas").delete().eq("id", id)

    if (error) {
      console.error("Supabase ideas delete error:", error)
      return NextResponse.json({ error: "Failed to delete idea", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Ideas DELETE API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
