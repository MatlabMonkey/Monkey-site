"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Save, X } from "lucide-react"
import ContactForm from "../../../components/ContactForm"
import PinGate from "../../../components/PinGate"
import { coerceContactDraft, type ContactDraft } from "../../../../lib/contacts"

const DRAFT_STORAGE_KEY = "contacts.reviewDraft"

type CreateApiResponse = {
  error?: string
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function parseDraft(raw: string | null): ContactDraft | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof ContactDraft, unknown>>
    return coerceContactDraft(parsed)
  } catch {
    return null
  }
}

export default function ReviewContactPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [draft, setDraft] = useState<ContactDraft | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const fromQuery = parseDraft(searchParams.get("draft"))
    if (fromQuery) {
      setDraft(fromQuery)
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(fromQuery))
      setLoadingDraft(false)
      return
    }

    const fromStorage = parseDraft(localStorage.getItem(DRAFT_STORAGE_KEY))
    setDraft(fromStorage)
    setLoadingDraft(false)
  }, [searchParams])

  useEffect(() => {
    if (!draft) return
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }, [draft])

  const saveContact = async () => {
    if (!draft || saving) return
    setSaving(true)
    setError("")

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      const data = (await res.json()) as CreateApiResponse
      if (!res.ok) {
        throw new Error(data.error || "Failed to save contact")
      }

      localStorage.removeItem(DRAFT_STORAGE_KEY)
      router.push("/workspace/contacts")
    } catch (nextError) {
      setError(getErrorMessage(nextError, "Failed to save contact"))
    } finally {
      setSaving(false)
    }
  }

  if (loadingDraft) {
    return (
      <PinGate>
        <div className="min-h-screen bg-[rgb(var(--bg))] px-6 py-12 text-[rgb(var(--text))]">
          <div className="mx-auto max-w-4xl text-sm text-[rgb(var(--text-muted))]">Loading draft...</div>
        </div>
      </PinGate>
    )
  }

  return (
    <PinGate>
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/workspace/contacts/capture" className="rounded-xl p-2 transition-colors hover:bg-[rgb(var(--surface-2))]">
              <ArrowLeft className="h-5 w-5 text-[rgb(var(--text-muted))]" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold md:text-4xl">Review Contact</h1>
              <p className="mt-1 text-[rgb(var(--text-muted))]">Edit extracted fields before saving.</p>
            </div>
          </div>

          {!draft && (
            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-8 text-center">
              <p className="text-[rgb(var(--text-muted))]">No draft found. Capture a transcript first.</p>
              <Link
                href="/workspace/contacts/capture"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--brand))] px-4 py-2 text-sm font-medium transition-colors hover:bg-[rgb(var(--brand-strong))]"
              >
                Go to Capture
              </Link>
            </div>
          )}

          {draft && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-6">
                <ContactForm value={draft} onChange={setDraft} disabled={saving} />
              </div>

              <details className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-6">
                <summary className="cursor-pointer text-sm font-medium text-[rgb(var(--text-muted))]">Raw transcript</summary>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-[rgb(var(--text-muted))]">{draft.raw_transcript || "No raw transcript."}</pre>
              </details>

              {error && (
                <div className="rounded-2xl border border-[rgb(127_29_29)] bg-[rgb(127_29_29_/_0.3)] p-3 text-sm text-[rgb(248_113_113)]">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveContact()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--brand))] px-4 py-2 text-sm font-medium transition-colors hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Contact"}
                </button>
                <Link
                  href="/workspace/contacts/capture"
                  className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--border))] px-4 py-2 text-sm transition-colors hover:bg-[rgb(var(--surface)_/_0.75)]"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </PinGate>
  )
}
