import { type NextRequest, NextResponse } from "next/server"
import { coerceContactDraft } from "../../../../lib/contacts"
import {
  ContactValidationError,
  getOpenAiApiKey,
  normalizeContactInput,
  validateContactsApiKey,
} from "../../../../lib/server/contacts"

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

const MAX_TRANSCRIPT_LENGTH = 12000

function extractJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Fallback search below.
  }

  for (let start = 0; start < raw.length; start += 1) {
    if (raw[start] !== "{") continue
    for (let end = raw.length - 1; end > start; end -= 1) {
      if (raw[end] !== "}") continue
      const candidate = raw.slice(start, end + 1)
      try {
        const parsed = JSON.parse(candidate) as unknown
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>
        }
      } catch {
        // Continue scanning.
      }
    }
  }

  throw new Error("Model did not return a valid JSON object")
}

export async function POST(request: NextRequest) {
  try {
    if (!validateContactsApiKey(request.headers)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as { transcript?: unknown }
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : ""
    if (!transcript) {
      return NextResponse.json({ error: "transcript is required" }, { status: 400 })
    }
    if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
      return NextResponse.json(
        { error: `transcript is too long (max ${MAX_TRANSCRIPT_LENGTH} chars)` },
        { status: 400 },
      )
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAiApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EXTRACTION_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "contact_extraction",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                job_title: { type: "string" },
                company: { type: "string" },
                industry: { type: "string" },
                location: { type: "string" },
                where_met: { type: "string" },
                interests: { type: "array", items: { type: "string" } },
                past_companies: { type: "array", items: { type: "string" } },
                email: { type: "string" },
                phone: { type: "string" },
                linkedin_url: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                notes: { type: "string" },
              },
              required: [
                "name",
                "job_title",
                "company",
                "industry",
                "location",
                "where_met",
                "interests",
                "past_companies",
                "email",
                "phone",
                "linkedin_url",
                "tags",
                "notes",
              ],
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "Extract contact details from transcripts. Return only JSON matching the schema. Use empty strings or empty arrays when unknown. Do not invent facts.",
          },
          {
            role: "user",
            content: transcript,
          },
        ],
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      return NextResponse.json(
        { error: "Extraction request failed", details },
        { status: response.status >= 400 && response.status < 500 ? response.status : 500 },
      )
    }

    const payload = (await response.json()) as ChatCompletionsResponse
    const modelContent = payload.choices?.[0]?.message?.content?.trim() || ""
    if (!modelContent) {
      return NextResponse.json({ error: "Extraction model returned empty content" }, { status: 500 })
    }

    const extracted = extractJsonObject(modelContent)
    const normalized = normalizeContactInput(extracted, { partial: false, requireTranscript: false })
    const draft = coerceContactDraft({
      ...normalized,
      raw_transcript: transcript,
    })

    return NextResponse.json({ draft })
  } catch (error) {
    if (error instanceof ContactValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("POST /api/contacts/extract error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
