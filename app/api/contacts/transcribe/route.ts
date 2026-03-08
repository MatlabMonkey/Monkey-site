import { type NextRequest, NextResponse } from "next/server"
import { getOpenAiApiKey, validateContactsApiKey } from "../../../../../lib/server/contacts"

const MAX_AUDIO_BYTES = 25 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    if (!validateContactsApiKey(request.headers)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const audio = formData.get("audio")

    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: "audio file is required" }, { status: 400 })
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "audio file is too large (max 25 MB)" }, { status: 400 })
    }

    const outbound = new FormData()
    const fileName = audio instanceof File && audio.name ? audio.name : "recording.webm"
    outbound.append("file", audio, fileName)
    outbound.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1")

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getOpenAiApiKey()}`,
      },
      body: outbound,
    })

    if (!response.ok) {
      const details = await response.text()
      return NextResponse.json(
        { error: "Transcription request failed", details },
        { status: response.status >= 400 && response.status < 500 ? response.status : 500 },
      )
    }

    const payload = (await response.json()) as { text?: string }
    const transcript = typeof payload.text === "string" ? payload.text.trim() : ""

    if (!transcript) {
      return NextResponse.json({ error: "Transcription returned empty text" }, { status: 500 })
    }

    return NextResponse.json({ transcript })
  } catch (error) {
    console.error("POST /api/contacts/transcribe error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
