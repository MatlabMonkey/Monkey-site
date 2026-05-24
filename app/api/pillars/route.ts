import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

type Pillar = {
  id: string
  title: string
  color: string
  active_focus: string
  dos: string[]
  donts: string[]
  quality_standard: string
  later: string[]
  sort_order: number
}

type JsonMap = Record<string, unknown>

const DEFAULT_PILLARS: Pillar[] = [
  {
    id: "career",
    title: "Career",
    color: "#00a2ff",
    active_focus: "Define one concrete career objective for this cycle.",
    dos: ["Ship high-value work weekly.", "Track outcomes, not activity.", "Protect deep work blocks."],
    donts: ["Don’t split focus across competing priorities.", "Don’t accept low-leverage busywork."],
    quality_standard: "Clear objective, measurable output, and weekly review.",
    later: ["Long-horizon opportunities", "Nice-to-have optimizations"],
    sort_order: 1,
  },
  {
    id: "people",
    title: "People",
    color: "#ff4fa3",
    active_focus: "Invest in one priority relationship outcome.",
    dos: ["Show up consistently.", "Communicate directly and kindly.", "Follow through on commitments."],
    donts: ["Don’t let reactive work replace important conversations.", "Don’t postpone repair when friction appears."],
    quality_standard: "Reliable presence, clean communication, and kept promises.",
    later: ["Optional social events", "Low-priority outreach"],
    sort_order: 2,
  },
  {
    id: "creation",
    title: "Creation",
    color: "#ffd21f",
    active_focus: "Finish one meaningful creation end-to-end.",
    dos: ["Publish iterations quickly.", "Keep scope tight.", "Use feedback loops."],
    donts: ["Don’t start new projects before closing the current one.", "Don’t polish before core value exists."],
    quality_standard: "Useful, shipped, and improved by real feedback.",
    later: ["Experimental concepts", "Archive ideas without active demand"],
    sort_order: 3,
  },
  {
    id: "constitution",
    title: "Constitution",
    color: "#f04438",
    active_focus: "Maintain the baseline habits that preserve clarity and energy.",
    dos: ["Sleep on schedule.", "Train consistently.", "Review and reset weekly."],
    donts: ["Don’t trade foundations for short-term output.", "Don’t ignore early signs of drift."],
    quality_standard: "Consistent execution of non-negotiable foundations.",
    later: ["Advanced protocols", "Optional optimizations"],
    sort_order: 4,
  },
]

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
}

function normalizeRow(row: JsonMap, fallback: Pillar): Pillar {
  return {
    id: typeof row.id === "string" && row.id ? row.id : fallback.id,
    title: typeof row.title === "string" && row.title ? row.title : fallback.title,
    color: typeof row.color === "string" && row.color ? row.color : fallback.color,
    active_focus: typeof row.active_focus === "string" ? row.active_focus : fallback.active_focus,
    dos: normalizeStringArray(row.dos).length ? normalizeStringArray(row.dos) : fallback.dos,
    donts: normalizeStringArray(row.donts).length ? normalizeStringArray(row.donts) : fallback.donts,
    quality_standard: typeof row.quality_standard === "string" ? row.quality_standard : fallback.quality_standard,
    later: normalizeStringArray(row.later).length ? normalizeStringArray(row.later) : fallback.later,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : fallback.sort_order,
  }
}

async function ensureSeededAndGetPillars() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from("pillars").select("*").order("sort_order", { ascending: true })

  if (error) throw error

  const rows = Array.isArray(data) ? data : []
  const byId = new Map(rows.map((row) => [String(row.id), row as JsonMap]))

  const upserts: Pillar[] = []
  const normalized = DEFAULT_PILLARS.map((fallback) => {
    const row = byId.get(fallback.id)
    const merged = row ? normalizeRow(row, fallback) : fallback

    if (!row) {
      upserts.push(merged)
    } else {
      const rowDos = normalizeStringArray(row.dos)
      const rowDonts = normalizeStringArray(row.donts)
      const rowLater = normalizeStringArray(row.later)
      const rowSort = typeof row.sort_order === "number" ? row.sort_order : undefined
      const needsRepair = !row.title || !row.color || !row.active_focus || !row.quality_standard || !rowSort || rowDos.length === 0 || rowDonts.length === 0 || rowLater.length === 0
      if (needsRepair) upserts.push(merged)
    }

    return merged
  })

  if (upserts.length > 0) {
    const { error: upsertError } = await supabase.from("pillars").upsert(
      upserts.map((pillar) => ({ ...pillar, updated_at: new Date().toISOString() })),
      { onConflict: "id" },
    )
    if (upsertError) throw upsertError
  }

  return normalized.sort((a, b) => a.sort_order - b.sort_order)
}

export async function GET() {
  try {
    const pillars = await ensureSeededAndGetPillars()
    return NextResponse.json({ pillars })
  } catch (error) {
    console.error("Pillars GET API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch pillars", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as JsonMap
    const input = Array.isArray(body.pillars) ? body.pillars : null

    if (!input || input.length === 0) {
      return NextResponse.json({ error: "pillars array is required" }, { status: 400 })
    }

    const base = await ensureSeededAndGetPillars()
    const baseById = new Map(base.map((pillar) => [pillar.id, pillar]))

    const updates: Pillar[] = []
    for (const item of input) {
      if (!item || typeof item !== "object") continue
      const row = item as JsonMap
      const id = typeof row.id === "string" ? row.id : ""
      const fallback = baseById.get(id)
      if (!fallback) continue

      updates.push({
        id,
        title: fallback.title,
        color: fallback.color,
        sort_order: fallback.sort_order,
        active_focus: typeof row.active_focus === "string" ? row.active_focus.trim() : fallback.active_focus,
        dos: normalizeStringArray(row.dos),
        donts: normalizeStringArray(row.donts),
        quality_standard:
          typeof row.quality_standard === "string" ? row.quality_standard.trim() : fallback.quality_standard,
        later: normalizeStringArray(row.later),
      })
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid pillars to update" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from("pillars").upsert(
      updates.map((pillar) => ({ ...pillar, updated_at: new Date().toISOString() })),
      { onConflict: "id" },
    )

    if (error) {
      console.error("Supabase pillars update error:", error)
      return NextResponse.json({ error: "Failed to update pillars", details: error.message }, { status: 500 })
    }

    const pillars = await ensureSeededAndGetPillars()
    return NextResponse.json({ pillars })
  } catch (error) {
    console.error("Pillars PATCH API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
