"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, PencilLine, Save, Trash2, X } from "lucide-react"
import ContactForm from "../../../components/ContactForm"
import PinGate from "../../../components/PinGate"
import { coerceContactDraft, type ContactDraft, type ContactRecord } from "../../../../lib/contacts"

type ContactApiResponse = {
  contact?: ContactRecord
  error?: string
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return date.toLocaleString()
}

function ValueBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
      <p className="mb-1 text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">{label}</p>
      <p className="text-sm text-[rgb(var(--text))]">{value || "Not provided"}</p>
    </div>
  )
}

function TagsBlock({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">{label}</p>
      {values.length === 0 ? (
        <p className="text-sm text-[rgb(var(--text-muted))]">None</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={`${label}-${value}`}
              className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.8)] px-2.5 py-1 text-xs text-[rgb(var(--text-muted))]"
            >
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [contact, setContact] = useState<ContactRecord | null>(null)
  const [draft, setDraft] = useState<ContactDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) return

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError("")

      try {
        const res = await fetch(`/api/contacts/${encodeURIComponent(id)}`, { cache: "no-store" })
        const data = (await res.json()) as ContactApiResponse
        if (!res.ok || !data.contact) {
          throw new Error(data.error || "Failed to load contact")
        }

        if (cancelled) return
        setContact(data.contact)
        setDraft(coerceContactDraft(data.contact))
      } catch (nextError) {
        if (cancelled) return
        setError(getErrorMessage(nextError, "Failed to load contact"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const saveChanges = async () => {
    if (!draft || !contact || saving) return
    setSaving(true)
    setError("")

    try {
      const res = await fetch(`/api/contacts/${encodeURIComponent(contact.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      const data = (await res.json()) as ContactApiResponse
      if (!res.ok || !data.contact) {
        throw new Error(data.error || "Failed to update contact")
      }

      setContact(data.contact)
      setDraft(coerceContactDraft(data.contact))
      setEditing(false)
    } catch (nextError) {
      setError(getErrorMessage(nextError, "Failed to update contact"))
    } finally {
      setSaving(false)
    }
  }

  const deleteContact = async () => {
    if (!contact || deleting) return
    if (!window.confirm("Delete this contact? This action cannot be undone.")) return

    setDeleting(true)
    setError("")
    try {
      const res = await fetch(`/api/contacts/${encodeURIComponent(contact.id)}`, { method: "DELETE" })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete contact")
      }

      router.push("/workspace/contacts")
    } catch (nextError) {
      setError(getErrorMessage(nextError, "Failed to delete contact"))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PinGate>
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/workspace/contacts" className="rounded-xl p-2 transition-colors hover:bg-[rgb(var(--surface-2))]">
              <ArrowLeft className="h-5 w-5 text-[rgb(var(--text-muted))]" />
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold md:text-4xl">{contact?.name || "Contact details"}</h1>
              {contact && <p className="mt-1 text-[rgb(var(--text-muted))]">Updated {formatDate(contact.updated_at)}</p>}
            </div>
            {contact && (
              <button
                type="button"
                onClick={() => {
                  setError("")
                  setEditing((prev) => {
                    if (prev && contact) {
                      setDraft(coerceContactDraft(contact))
                    }
                    return !prev
                  })
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--border))] px-4 py-2 text-sm transition-colors hover:bg-[rgb(var(--surface)_/_0.75)]"
              >
                <PencilLine className="h-4 w-4" />
                {editing ? "Stop Editing" : "Edit"}
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-[rgb(127_29_29)] bg-[rgb(127_29_29_/_0.3)] p-3 text-sm text-[rgb(248_113_113)]">
              {error}
            </div>
          )}

          {loading && <p className="text-sm text-[rgb(var(--text-muted))]">Loading contact...</p>}

          {!loading && !contact && (
            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-8 text-center text-[rgb(var(--text-muted))]">
              Contact not found.
            </div>
          )}

          {!loading && contact && editing && draft && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-6">
                <ContactForm value={draft} onChange={setDraft} disabled={saving || deleting} />
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveChanges()}
                  disabled={saving || deleting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--brand))] px-4 py-2 text-sm font-medium transition-colors hover:bg-[rgb(var(--brand-strong))] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  disabled={saving || deleting}
                  onClick={() => {
                    setDraft(coerceContactDraft(contact))
                    setEditing(false)
                    setError("")
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--border))] px-4 py-2 text-sm transition-colors hover:bg-[rgb(var(--surface)_/_0.75)] disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void deleteContact()}
                  disabled={saving || deleting}
                  className="inline-flex items-center gap-2 rounded-xl border border-[rgb(127_29_29)] px-4 py-2 text-sm text-[rgb(248_113_113)] transition-colors hover:bg-[rgb(127_29_29_/_0.3)] disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          )}

          {!loading && contact && !editing && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <ValueBlock label="Name" value={contact.name} />
                <ValueBlock label="Job title" value={contact.job_title} />
                <ValueBlock label="Company" value={contact.company} />
                <ValueBlock label="Industry" value={contact.industry} />
                <ValueBlock label="Location" value={contact.location} />
                <ValueBlock label="Where met" value={contact.where_met} />
                <ValueBlock label="Email" value={contact.email} />
                <ValueBlock label="Phone" value={contact.phone} />
                <ValueBlock label="LinkedIn URL" value={contact.linkedin_url} />
              </div>

              <TagsBlock label="Interests" values={contact.interests} />
              <TagsBlock label="Past companies" values={contact.past_companies} />
              <TagsBlock label="Tags" values={contact.tags} />

              <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
                <p className="mb-1 text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">Notes</p>
                <p className="whitespace-pre-wrap text-sm text-[rgb(var(--text))]">{contact.notes || "No notes"}</p>
              </div>

              <details className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
                <summary className="cursor-pointer text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">Raw transcript</summary>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-[rgb(var(--text-muted))]">
                  {contact.raw_transcript || "No raw transcript"}
                </pre>
              </details>

              <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4 text-xs text-[rgb(var(--text-muted))]">
                <p>Created: {formatDate(contact.created_at)}</p>
                <p className="mt-1">Updated: {formatDate(contact.updated_at)}</p>
              </div>

              <button
                type="button"
                onClick={() => void deleteContact()}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl border border-[rgb(127_29_29)] px-4 py-2 text-sm text-[rgb(248_113_113)] transition-colors hover:bg-[rgb(127_29_29_/_0.3)] disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>
    </PinGate>
  )
}
