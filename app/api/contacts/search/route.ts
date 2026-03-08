import { type NextRequest, NextResponse } from "next/server"
import { type ContactSearchResult } from "../../../../lib/contacts"
import {
  buildSearchFilter,
  ContactValidationError,
  generateEmbedding,
  getOpenAiApiKey,
  getSupabaseAdminClient,
  mapContactRecord,
  normalizeSearchQuery,
  resolveContactUserId,
  toVectorLiteral,
  validateContactsApiKey,
} from "../../../../lib/server/contacts"

type MatchRow = {
  contact_id: string
  similarity: number
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

function parseLimit(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_LIMIT
  return Math.min(Math.max(Math.trunc(raw), 1), MAX_LIMIT)
}

export async function POST(request: NextRequest) {
  try {
    if (!validateContactsApiKey(request.headers)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      query?: unknown
      limit?: unknown
      user_id?: unknown
      threshold?: unknown
    }

    const query = normalizeSearchQuery(body.query)
    const limit = parseLimit(body.limit)
    const threshold =
      typeof body.threshold === "number" && Number.isFinite(body.threshold)
        ? Math.min(Math.max(body.threshold, 0), 1)
        : 0.15

    const userId = resolveContactUserId({
      bodyUserId: body.user_id,
      queryUserId: request.nextUrl.searchParams.get("user_id"),
      headerUserId: request.headers.get("x-user-id"),
    })
    if (!userId) {
      return NextResponse.json({ error: "user_id contains invalid characters" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const queryEmbedding = await generateEmbedding({
      apiKey: getOpenAiApiKey(),
      input: query,
    })

    const { data: matchRows, error: matchError } = await supabase.rpc("match_contact_embeddings", {
      query_user_id: userId,
      query_embedding: toVectorLiteral(queryEmbedding),
      match_threshold: threshold,
      match_count: limit,
    })

    if (matchError) {
      return NextResponse.json({ error: "Failed to search contacts", details: matchError.message }, { status: 500 })
    }

    const matches = Array.isArray(matchRows) ? (matchRows as MatchRow[]) : []
    const semanticIds = matches.map((row) => row.contact_id).filter((id): id is string => typeof id === "string")
    const similarityById = new Map(matches.map((row) => [row.contact_id, row.similarity]))
    const merged: ContactSearchResult[] = []
    const seen = new Set<string>()

    if (semanticIds.length > 0) {
      const { data: semanticContacts, error: semanticError } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .in("id", semanticIds)

      if (semanticError) {
        return NextResponse.json(
          { error: "Failed to fetch semantic search results", details: semanticError.message },
          { status: 500 },
        )
      }

      const rowById = new Map(
        (semanticContacts || []).map((row) => [String((row as Record<string, unknown>).id), row as Record<string, unknown>]),
      )

      for (const id of semanticIds) {
        const row = rowById.get(id)
        if (!row) continue
        const contact = mapContactRecord(row)
        merged.push({
          ...contact,
          source: "semantic",
          similarity: similarityById.get(id),
        })
        seen.add(id)
      }
    }

    if (merged.length < limit) {
      const needed = limit - merged.length
      const { data: lexicalRows, error: lexicalError } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .or(buildSearchFilter(query))
        .order("updated_at", { ascending: false })
        .limit(Math.max(needed, 6))

      if (lexicalError) {
        return NextResponse.json(
          { error: "Failed to fetch lexical fallback results", details: lexicalError.message },
          { status: 500 },
        )
      }

      for (const row of lexicalRows || []) {
        const mapped = mapContactRecord(row as Record<string, unknown>)
        if (seen.has(mapped.id)) continue
        merged.push({ ...mapped, source: "text" })
        seen.add(mapped.id)
        if (merged.length >= limit) break
      }
    }

    return NextResponse.json({ results: merged.slice(0, limit) })
  } catch (error) {
    if (error instanceof ContactValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("POST /api/contacts/search error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
