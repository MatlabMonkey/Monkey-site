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
    active_focus: "Find a new job.",
    dos: [
      "Apply to at least one real role each workday",
      "Improve one resume / portfolio artifact weekly",
      "Send one useful follow-up or reachout weekly",
    ],
    donts: [
      "Look at my phone during work blocks",
      "Seek reassurance before one work artifact",
      "Apply to random roles just to feel productive",
    ],
    quality_standard: "Applications are targeted enough that I would be proud to discuss them",
    later: [
      "Own and finish one technical project with documented impact",
      "Build a portfolio project",
      "Publish a technical writeup",
    ],
    sort_order: 1,
  },
  {
    id: "people",
    title: "People",
    color: "#ff4fa3",
    active_focus: "Take real chances to connect.",
    dos: [
      "Go to run club",
      "Talk to people at run club",
      "Talk to someone new at a bar or public event",
      "Say yes to meaningful friend / family plans",
    ],
    donts: [
      "Hide behind work when people are actually hanging out",
      "Stand silently and wait for others to initiate",
      "Scroll instead of reaching out",
    ],
    quality_standard: "Show up present, curious, and willing to initiate",
    later: ["Plan Big Sur / family trip", "Host a party or group event", "Build a stronger dating pipeline"],
    sort_order: 2,
  },
  {
    id: "creation",
    title: "Creation",
    color: "#ffd21f",
    active_focus: "Write one song this year.",
    dos: [
      "Play guitar or build creatively every week",
      "Save riffs, lyrics, and ideas immediately",
      "Make rough versions instead of waiting",
      "Plan one memorable group experience",
    ],
    donts: [
      "Consume when I actually want to create",
      "Wait for the perfect idea",
      "Start ten projects before finishing one",
    ],
    quality_standard: "A complete rough song exists and can be shared, even if imperfect",
    later: [
      "Start a YouTube channel experiment",
      "Plan a Costa Rica-style game or trip activity",
      "Build a creative project with friends",
    ],
    sort_order: 3,
  },
  {
    id: "constitution",
    title: "Constitution",
    color: "#f04438",
    active_focus: "Run a marathon before 24.",
    dos: [
      "Run weekdays, adding 0.05 miles when healthy",
      "Add 2 seconds to plank daily",
      "Strength train 5 days per week",
      "Use worry window / CBT tools before spiraling",
    ],
    donts: [
      "Skip PT / recovery while increasing mileage",
      "Let work panic destroy health routines",
      "Use caffeine or sleep debt as fake productivity",
      "Turn one bad day into an identity verdict",
    ],
    quality_standard: "Train sustainably enough to get stronger without breaking down",
    later: [
      "Dial in sleep routine",
      "Track caffeine / Adderall / anxiety patterns",
      "Build a durable PT and mobility system",
    ],
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
