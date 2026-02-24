"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Archive, ArchiveRestore, Pin, PinOff, Plus, Trash2 } from "lucide-react"
import PinGate from "../../components/PinGate"

type Idea = {
  id: string
  content: string
  source: string
  tags: string[]
  pinned: boolean
  archived: boolean
  created_at: string
  updated_at: string
}

export default function WorkspaceIdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [content, setContent] = useState("")
  const [tagsInput, setTagsInput] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState("")

  const ideaCountLabel = useMemo(() => `${ideas.length} idea${ideas.length === 1 ? "" : "s"}`, [ideas])

  const loadIdeas = async (archived: boolean) => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/ideas?archived=${String(archived)}&limit=200`, { cache: "no-store" })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to load ideas")
      }

      setIdeas(Array.isArray(data.ideas) ? data.ideas : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ideas")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadIdeas(showArchived)
  }, [showArchived])

  const createIdea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return

    setSubmitting(true)
    setError("")
    try {
      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)

      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), source: "workspace", tags }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to create idea")
      }

      setContent("")
      setTagsInput("")
      await loadIdeas(showArchived)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create idea")
    } finally {
      setSubmitting(false)
    }
  }

  const patchIdea = async (id: string, updates: Record<string, unknown>) => {
    setError("")
    const res = await fetch("/api/ideas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || "Failed to update idea")
    }
  }

  const togglePinned = async (idea: Idea) => {
    try {
      await patchIdea(idea.id, { pinned: !idea.pinned })
      await loadIdeas(showArchived)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update idea")
    }
  }

  const toggleArchived = async (idea: Idea) => {
    try {
      await patchIdea(idea.id, { archived: !idea.archived })
      await loadIdeas(showArchived)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update idea")
    }
  }

  const removeIdea = async (id: string) => {
    try {
      const res = await fetch(`/api/ideas?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete idea")
      }
      await loadIdeas(showArchived)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete idea")
    }
  }

  return (
    <PinGate>
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/workspace" className="p-2 rounded-xl hover:bg-[rgb(var(--surface-2))] transition-colors">
              <ArrowLeft className="w-5 h-5 text-[rgb(var(--text-muted))]" />
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold">Ideas</h1>
              <p className="text-[rgb(var(--text-muted))] mt-1">{ideaCountLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowArchived((prev) => !prev)}
              className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface)_/_0.6)] transition-colors"
            >
              {showArchived ? "Show Active" : "Show Archived"}
            </button>
          </div>

          <form onSubmit={createIdea} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-5 mb-6 space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Capture an idea..."
              rows={4}
              className="w-full rounded-xl bg-[rgb(var(--surface-2)_/_0.7)] border border-[rgb(var(--border))] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
            />
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="tags (comma separated)"
              className="w-full rounded-xl bg-[rgb(var(--surface-2)_/_0.7)] border border-[rgb(var(--border))] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
            />
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {submitting ? "Saving..." : "Add Idea"}
            </button>
          </form>

          {error && (
            <div className="mb-4 rounded-xl border border-[rgb(127_29_29)] bg-[rgb(127_29_29_/_0.35)] p-3 text-sm text-[rgb(239_68_68)]">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {loading && <div className="text-[rgb(var(--text-muted))]">Loading ideas...</div>}
            {!loading && ideas.length === 0 && (
              <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.6)] p-8 text-center text-[rgb(var(--text-muted))]">
                No ideas yet.
              </div>
            )}
            {ideas.map((idea) => (
              <article key={idea.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-4">
                <p className="whitespace-pre-wrap leading-relaxed">{idea.content}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--text-muted))]">
                  <span>{new Date(idea.created_at).toLocaleString()}</span>
                  <span>•</span>
                  <span>{idea.source}</span>
                  {idea.tags?.length > 0 && (
                    <>
                      <span>•</span>
                      <span>{idea.tags.join(", ")}</span>
                    </>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void togglePinned(idea)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2)_/_0.7)]"
                  >
                    {idea.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    {idea.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleArchived(idea)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2)_/_0.7)]"
                  >
                    {idea.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    {idea.archived ? "Restore" : "Archive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeIdea(idea.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgb(127_29_29)] text-[rgb(248_113_113)] hover:bg-[rgb(127_29_29_/_0.3)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </PinGate>
  )
}
