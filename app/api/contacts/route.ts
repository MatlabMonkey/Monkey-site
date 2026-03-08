import { type NextRequest, NextResponse } from "next/server"
import { coerceContactDraft } from "../../../lib/contacts"
import {
  buildSearchFilter,
  ContactValidationError,
  getOpenAiApiKey,
  getSupabaseAdminClient,
  mapContactRecord,
  normalizeContactInput,
  resolveContactUserId,
  upsertEmbeddingForContact,
  validateContactsApiKey,
} from "../../../lib/server/contacts"

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 100

function parseLimit(raw: string | null, fallback = DEFAULT_LIMIT) {
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT)
}

function parseOffset(raw: string | null) {
  if (!raw) return 0
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(Math.trunc(parsed), 0)
}

export async function GET(request: NextRequest) {
  try {
    const userId = resolveContactUserId({
      queryUserId: request.nextUrl.searchParams.get("user_id"),
      headerUserId: request.headers.get("x-user-id"),
    })
    if (!userId) {
      return NextResponse.json({ error: "user_id contains invalid characters" }, { status: 400 })
    }

    const q = request.nextUrl.searchParams.get("q")?.trim() || ""
    if (q.length > 120) {
      return NextResponse.json({ error: "q is too long (max 120 chars)" }, { status: 400 })
    }

    const limit = parseLimit(request.nextUrl.searchParams.get("limit"))
    const offset = parseOffset(request.nextUrl.searchParams.get("offset"))

    const supabase = getSupabaseAdminClient()
    let query = supabase
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (q) {
      query = query.or(buildSearchFilter(q))
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: "Failed to fetch contacts", details: error.message }, { status: 500 })
    }

    const contacts = (data || []).map((row) => mapContactRecord(row as Record<string, unknown>))
    return NextResponse.json({ contacts })
  } catch (error) {
    console.error("GET /api/contacts error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateContactsApiKey(request.headers)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const userId = resolveContactUserId({
      bodyUserId: body.user_id,
      queryUserId: request.nextUrl.searchParams.get("user_id"),
      headerUserId: request.headers.get("x-user-id"),
    })

    if (!userId) {
      return NextResponse.json({ error: "user_id contains invalid characters" }, { status: 400 })
    }

    const normalized = normalizeContactInput(body, { partial: false, requireTranscript: true })
    const contactDraft = coerceContactDraft(normalized)

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        user_id: userId,
        ...contactDraft,
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to create contact", details: error.message }, { status: 500 })
    }

    const contact = mapContactRecord(data as Record<string, unknown>)

    try {
      await upsertEmbeddingForContact({
        supabase,
        contactId: contact.id,
        userId,
        contact: contactDraft,
        openAiApiKey: getOpenAiApiKey(),
      })
    } catch (embeddingError) {
      // Best-effort rollback to avoid partially created records with no embedding.
      await supabase.from("contacts").delete().eq("id", contact.id).eq("user_id", userId)
      throw embeddingError
    }

    return NextResponse.json({ contact }, { status: 201 })
  } catch (error) {
    if (error instanceof ContactValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("POST /api/contacts error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
