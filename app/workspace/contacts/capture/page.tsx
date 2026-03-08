"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Sparkles } from "lucide-react"
import PinGate from "../../../components/PinGate"
import type { ContactDraft } from "../../../../lib/contacts"

const DRAFT_STORAGE_KEY = "contacts.reviewDraft"

type ExtractApiResponse = {
  draft?: ContactDraft
  error?: string
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export default function CaptureContactPage() {
  const router = useRouter()
  const [transcript, setTranscript] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState("")

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!transcript.trim() || extracting) return

    setExtracting(true)
    setError("")

    try {
      const res = await fetch("/api/contacts/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript.trim() }),
      })
      const data = (await res.json()) as ExtractApiResponse
      if (!res.ok || !data.draft) {
        throw new Error(data.error || "Failed to extract contact")
      }

      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data.draft))
      const serializedDraft = encodeURIComponent(JSON.stringify(data.draft))
      router.push(`/workspace/contacts/review?draft=${serializedDraft}`)
    } catch (nextError) {
      setError(getErrorMessage(nextError, "Failed to extract contact"))
    } finally {
      setExtracting(false)
    }
  }

  return (
    <PinGate>
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/workspace/contacts" className="rounded-xl p-2 transition-colors hover:bg-[rgb(var(--surface-2))]">
              <ArrowLeft className="h-5 w-5 text-[rgb(var(--text-muted))]" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold md:text-4xl">Capture Contact</h1>
              <p className="mt-1 text-[rgb(var(--text-muted))]">Paste your transcript and extract contact details.</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-6">
            <label className="mb-4 block space-y-2">
              <span className="text-sm text-[rgb(var(--text-muted))]">Transcript</span>
              <textarea
                rows={16}
                value={transcript}
                disabled={extracting}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="Paste transcript here..."
                className="w-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--brand))] disabled:opacity-70"
              />
            </label>

            {error && (
              <div className="mb-4 rounded-2xl border border-[rgb(127_29_29)] bg-[rgb(127_29_29_/_0.3)] p-3 text-sm text-[rgb(248_113_113)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!transcript.trim() || extracting}
              className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--brand))] px-4 py-2 text-sm font-medium transition-colors hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {extracting ? "Extracting..." : "Extract Contact"}
            </button>
          </form>
        </div>
      </div>
    </PinGate>
  )
}
