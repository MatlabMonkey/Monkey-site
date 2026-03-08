import { type NextRequest, NextResponse } from "next/server"
import { coerceContactDraft } from "../../../../lib/contacts"
import {
  ContactValidationError,
  getOpenAiApiKey,
  getSupabaseAdminClient,
  hasEmbeddingRelevantChange,
  mapContactRecord,
  normalizeContactInput,
  resolveContactUserId,
  upsertEmbeddingForContact,
  validateContactsApiKey,
} from "../../../../lib/server/contacts"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const userId = resolveContactUserId({
      queryUserId: request.nextUrl.searchParams.get("user_id"),
      headerUserId: request.headers.get("x-user-id"),
    })

    if (!userId) {
      return NextResponse.json({ error: "user_id contains invalid characters" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: "Failed to fetch contact", details: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    return NextResponse.json({ contact: mapContactRecord(data as Record<string, unknown>) })
  } catch (error) {
    console.error("GET /api/contacts/[id] error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!validateContactsApiKey(request.headers)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const userId = resolveContactUserId({
      bodyUserId: body.user_id,
      queryUserId: request.nextUrl.searchParams.get("user_id"),
      headerUserId: request.headers.get("x-user-id"),
    })

    if (!userId) {
      return NextResponse.json({ error: "user_id contains invalid characters" }, { status: 400 })
    }

    const updates = normalizeContactInput(body, { partial: true })
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("contacts")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")

    if (error) {
      return NextResponse.json({ error: "Failed to update contact", details: error.message }, { status: 500 })
    }
    if (!data?.length) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const contact = mapContactRecord(data[0] as Record<string, unknown>)

    if (hasEmbeddingRelevantChange(updates)) {
      await upsertEmbeddingForContact({
        supabase,
        contactId: contact.id,
        userId,
        contact: coerceContactDraft(contact),
        openAiApiKey: getOpenAiApiKey(),
      })
    }

    return NextResponse.json({ contact })
  } catch (error) {
    if (error instanceof ContactValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("PATCH /api/contacts/[id] error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!validateContactsApiKey(request.headers)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    const userId = resolveContactUserId({
      queryUserId: request.nextUrl.searchParams.get("user_id"),
      headerUserId: request.headers.get("x-user-id"),
    })

    if (!userId) {
      return NextResponse.json({ error: "user_id contains invalid characters" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")

    if (error) {
      return NextResponse.json({ error: "Failed to delete contact", details: error.message }, { status: 500 })
    }
    if (!data?.length) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/contacts/[id] error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
