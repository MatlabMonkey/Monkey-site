import { createHash } from "crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  coerceContactDraft,
  EMBEDDING_RELEVANT_FIELDS,
  type ContactDraft,
  type ContactRecord,
} from "../contacts"

const USER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
const MAX_QUERY_LENGTH = 120
const EMBEDDING_DIMENSIONS = 1536

const STRING_LIMITS: Record<Exclude<keyof ContactDraft, "interests" | "past_companies" | "tags">, number> = {
  name: 160,
  job_title: 160,
  company: 160,
  industry: 120,
  location: 120,
  where_met: 220,
  email: 254,
  phone: 64,
  linkedin_url: 400,
  notes: 4000,
  raw_transcript: 12000,
}

const ARRAY_LIMITS: Record<Extract<keyof ContactDraft, "interests" | "past_companies" | "tags">, { items: number; itemLength: number }> =
  {
    interests: { items: 24, itemLength: 80 },
    past_companies: { items: 20, itemLength: 120 },
    tags: { items: 20, itemLength: 48 },
  }

type MutableContactFields = Omit<ContactDraft, never>

export class ContactValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ContactValidationError"
  }
}

function normalizeStringField(field: keyof typeof STRING_LIMITS, value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value !== "string") {
    throw new ContactValidationError(`${field} must be a string`)
  }
  const trimmed = value.trim()
  if (trimmed.length > STRING_LIMITS[field]) {
    throw new ContactValidationError(`${field} is too long (max ${STRING_LIMITS[field]} chars)`)
  }
  return trimmed
}

function normalizeStringArrayField(field: keyof typeof ARRAY_LIMITS, value: unknown): string[] {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value)) {
    throw new ContactValidationError(`${field} must be an array of strings`)
  }

  const { items, itemLength } = ARRAY_LIMITS[field]
  const unique = new Set<string>()

  for (const item of value) {
    if (typeof item !== "string") continue
    const trimmed = item.trim()
    if (!trimmed) continue
    if (trimmed.length > itemLength) {
      throw new ContactValidationError(`${field} entries must be ${itemLength} chars or less`)
    }
    unique.add(trimmed)
    if (unique.size > items) {
      throw new ContactValidationError(`${field} can contain at most ${items} entries`)
    }
  }

  return Array.from(unique)
}

function normalizeLinkedInUrl(value: string): string {
  if (!value) return ""
  if (!/^https?:\/\//i.test(value)) {
    throw new ContactValidationError("linkedin_url must start with http:// or https://")
  }
  return value
}

function normalizeEmail(value: string): string {
  if (!value) return ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new ContactValidationError("email must be a valid email address")
  }
  return value.toLowerCase()
}

function normalizePhone(value: string): string {
  if (!value) return ""
  if (!/^[+\d().\-\s]{5,64}$/.test(value)) {
    throw new ContactValidationError("phone contains invalid characters")
  }
  return value
}

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase credentials are not configured")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function resolveContactUserId({
  bodyUserId,
  queryUserId,
  headerUserId,
}: {
  bodyUserId?: unknown
  queryUserId?: string | null
  headerUserId?: string | null
}): string | null {
  const bodyCandidate = typeof bodyUserId === "string" ? bodyUserId.trim() : ""
  const queryCandidate = queryUserId?.trim() || ""
  const headerCandidate = headerUserId?.trim() || ""
  const candidate = bodyCandidate || queryCandidate || headerCandidate || "demo-user"

  return USER_ID_PATTERN.test(candidate) ? candidate : null
}

export function validateContactsApiKey(headers: Headers): boolean {
  const configured = process.env.CONTACTS_API_KEY?.trim()
  if (!configured) return true

  const authHeader = headers.get("authorization")
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : ""
  const headerToken = headers.get("x-api-key")?.trim() || ""
  const token = bearerToken || headerToken

  return token === configured
}

export function getOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  return apiKey
}

export function normalizeContactInput(
  input: Record<string, unknown>,
  options: { partial?: boolean; requireTranscript?: boolean } = {},
): Partial<MutableContactFields> {
  const { partial = false, requireTranscript = false } = options
  const updates: Partial<MutableContactFields> = {}

  const stringFields = Object.keys(STRING_LIMITS) as Array<keyof typeof STRING_LIMITS>
  for (const field of stringFields) {
    if (partial && !(field in input)) continue
    let normalized = normalizeStringField(field, input[field])
    if (field === "email") normalized = normalizeEmail(normalized)
    if (field === "phone") normalized = normalizePhone(normalized)
    if (field === "linkedin_url") normalized = normalizeLinkedInUrl(normalized)
    updates[field] = normalized
  }

  const arrayFields = Object.keys(ARRAY_LIMITS) as Array<keyof typeof ARRAY_LIMITS>
  for (const field of arrayFields) {
    if (partial && !(field in input)) continue
    updates[field] = normalizeStringArrayField(field, input[field])
  }

  if (requireTranscript && !updates.raw_transcript) {
    throw new ContactValidationError("raw_transcript is required")
  }

  if (partial && Object.keys(updates).length === 0) {
    throw new ContactValidationError("No valid contact fields were provided")
  }

  return updates
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export function buildContactEmbeddingContent(contact: ContactDraft): string {
  const parts: string[] = []

  if (contact.name) parts.push(`Name: ${contact.name}`)
  if (contact.job_title) parts.push(`Job title: ${contact.job_title}`)
  if (contact.company) parts.push(`Company: ${contact.company}`)
  if (contact.industry) parts.push(`Industry: ${contact.industry}`)
  if (contact.location) parts.push(`Location: ${contact.location}`)
  if (contact.where_met) parts.push(`Where met: ${contact.where_met}`)
  if (contact.interests.length > 0) parts.push(`Interests: ${contact.interests.join(", ")}`)
  if (contact.past_companies.length > 0) parts.push(`Past companies: ${contact.past_companies.join(", ")}`)
  if (contact.email) parts.push(`Email: ${contact.email}`)
  if (contact.phone) parts.push(`Phone: ${contact.phone}`)
  if (contact.linkedin_url) parts.push(`LinkedIn: ${contact.linkedin_url}`)
  if (contact.tags.length > 0) parts.push(`Tags: ${contact.tags.join(", ")}`)
  if (contact.notes) parts.push(`Notes: ${contact.notes}`)
  if (contact.raw_transcript) parts.push(`Transcript: ${contact.raw_transcript}`)

  return collapseWhitespace(parts.join("\n")).slice(0, 8000)
}

function hashContent(contentText: string): string {
  return createHash("sha256").update(contentText).digest("hex")
}

export function toVectorLiteral(embedding: number[]): string {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected embedding length ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`)
  }

  return `[${embedding.join(",")}]`
}

export async function generateEmbedding({
  apiKey,
  input,
}: {
  apiKey: string
  input: string
}): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input,
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Embedding request failed: ${response.status} ${details}`)
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>
  }
  const embedding = payload.data?.[0]?.embedding
  if (!Array.isArray(embedding) || embedding.some((value) => typeof value !== "number")) {
    throw new Error("OpenAI embedding response did not include a valid vector")
  }

  return embedding
}

export async function upsertEmbeddingForContact({
  supabase,
  contactId,
  userId,
  contact,
  openAiApiKey,
}: {
  supabase: SupabaseClient
  contactId: string
  userId: string
  contact: ContactDraft
  openAiApiKey: string
}) {
  const contentText = buildContactEmbeddingContent(contact)
  const contentHash = hashContent(contentText)

  const { data: existing, error: existingError } = await supabase
    .from("contact_embeddings")
    .select("content_hash")
    .eq("contact_id", contactId)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to check existing embedding: ${existingError.message}`)
  }

  if (existing?.content_hash === contentHash) {
    return
  }

  const embedding = await generateEmbedding({ apiKey: openAiApiKey, input: contentText })
  const vectorLiteral = toVectorLiteral(embedding)

  const { error: upsertError } = await supabase.from("contact_embeddings").upsert(
    {
      contact_id: contactId,
      user_id: userId,
      embedding: vectorLiteral,
      content_text: contentText,
      content_hash: contentHash,
    },
    { onConflict: "contact_id" },
  )

  if (upsertError) {
    throw new Error(`Failed to upsert embedding: ${upsertError.message}`)
  }
}

export function hasEmbeddingRelevantChange(patch: Partial<ContactDraft>) {
  return EMBEDDING_RELEVANT_FIELDS.some((field) => field in patch)
}

export function normalizeSearchQuery(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new ContactValidationError("query must be a string")
  }
  const cleaned = raw.trim().replace(/\s+/g, " ")
  if (!cleaned) {
    throw new ContactValidationError("query is required")
  }
  if (cleaned.length > MAX_QUERY_LENGTH) {
    throw new ContactValidationError(`query is too long (max ${MAX_QUERY_LENGTH} chars)`)
  }
  return cleaned
}

export function buildSearchFilter(query: string): string {
  const escaped = query.replace(/[,%()]/g, " ").trim()
  return [
    `name.ilike.%${escaped}%`,
    `job_title.ilike.%${escaped}%`,
    `company.ilike.%${escaped}%`,
    `industry.ilike.%${escaped}%`,
    `location.ilike.%${escaped}%`,
    `where_met.ilike.%${escaped}%`,
    `notes.ilike.%${escaped}%`,
    `raw_transcript.ilike.%${escaped}%`,
  ].join(",")
}

export function mapContactRecord(row: Record<string, unknown>): ContactRecord {
  const draft = coerceContactDraft(row as Partial<Record<keyof ContactDraft, unknown>>)

  return {
    id: typeof row.id === "string" ? row.id : "",
    user_id: typeof row.user_id === "string" ? row.user_id : "",
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    ...draft,
  }
}
