import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

type CapturePayload = {
  content?: unknown
  text?: unknown
  idea?: unknown
  source?: unknown
  tags?: unknown
  pinned?: unknown
  metadata?: unknown
}

function getCaptureToken(request: NextRequest): string {
  const authHeader = request.headers.get("authorization")
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim()
  }
  return request.headers.get("x-api-key")?.trim() || ""
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

export async function POST(request: NextRequest) {
  try {
    const configuredKey = process.env.CAPTURE_API_KEY
    if (!configuredKey) {
      return NextResponse.json({ error: "CAPTURE_API_KEY is not configured" }, { status: 500 })
    }

    const token = getCaptureToken(request)
    if (!token || token !== configuredKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: CapturePayload = {}
    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      body = (await request.json()) as CapturePayload
    } else {
      const raw = (await request.text()).trim()
      body = { content: raw }
    }

    const rawContent = [body.content, body.text, body.idea].find((value) => typeof value === "string")
    const content = typeof rawContent === "string" ? rawContent.trim() : ""

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "shortcut"
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
      : []
    const pinned = Boolean(body.pinned)
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {}

    const supabase = getSupabaseAdmin()
    const { data: idea, error } = await supabase
      .from("ideas")
      .insert([{ content, source, tags, pinned, metadata }])
      .select()
      .single()

    if (error) {
      console.error("Supabase capture insert error:", error)
      return NextResponse.json({ error: "Failed to capture idea", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, idea }, { status: 201 })
  } catch (error) {
    console.error("Capture API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
