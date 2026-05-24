"use client"

import { Pencil, Save } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

type Pillar = {
  id: string
  title: string
  color: string
  active_focus: string
  dos: string[]
  donts: string[]
  quality_standard: string
  later: string[]
  sort_order: number
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function toMultiline(items: string[]): string {
  return items.join("\n")
}

function PillarCard({
  pillar,
  editMode,
  onChange,
}: {
  pillar: Pillar
  editMode: boolean
  onChange: (pillar: Pillar) => void
}) {
  const titleGradient = {
    backgroundImage: `linear-gradient(135deg, ${pillar.color} 0%, rgba(255,255,255,0.95) 100%)`,
  }

  return (
    <article
      className="rounded-3xl border border-white/15 bg-white/[0.07] p-5 md:p-6 transition-transform duration-200 hover:-translate-y-0.5"
      style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 30px ${pillar.color}22` }}
    >
      <h2
        className="bg-clip-text text-center text-3xl font-extrabold tracking-wide text-transparent md:text-4xl"
        style={titleGradient}
      >
        {pillar.title}
      </h2>

      <div className="mt-5 space-y-4">
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text)_/_0.9)]">Do</h3>
          {editMode ? (
            <textarea
              value={toMultiline(pillar.dos)}
              onChange={(e) => onChange({ ...pillar, dos: splitLines(e.target.value) })}
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/30 p-3 text-base text-[rgb(var(--text))] outline-none focus:border-white/35"
              rows={4}
            />
          ) : (
            <ul className="mt-2 list-disc space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 pl-8 text-base leading-relaxed text-[rgb(var(--text)_/_0.98)]">
              {pillar.dos.map((item) => (
                <li key={`${pillar.id}-do-${item}`}>{item}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text)_/_0.9)]">Don’t</h3>
          {editMode ? (
            <textarea
              value={toMultiline(pillar.donts)}
              onChange={(e) => onChange({ ...pillar, donts: splitLines(e.target.value) })}
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/30 p-3 text-base text-[rgb(var(--text))] outline-none focus:border-white/35"
              rows={4}
            />
          ) : (
            <ul className="mt-2 list-disc space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 pl-8 text-base leading-relaxed text-[rgb(var(--text)_/_0.98)]">
              {pillar.donts.map((item) => (
                <li key={`${pillar.id}-dont-${item}`}>{item}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text)_/_0.9)]">Quality Standard</h3>
          {editMode ? (
            <textarea
              value={pillar.quality_standard}
              onChange={(e) => onChange({ ...pillar, quality_standard: e.target.value })}
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/30 p-3 text-base text-[rgb(var(--text))] outline-none focus:border-white/35"
              rows={3}
            />
          ) : (
            <p className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-base leading-relaxed text-[rgb(var(--text)_/_0.98)]">{pillar.quality_standard}</p>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <details>
            <summary className="cursor-pointer select-none text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text)_/_0.88)]">Later</summary>
            {editMode ? (
              <textarea
                value={toMultiline(pillar.later)}
                onChange={(e) => onChange({ ...pillar, later: splitLines(e.target.value) })}
                className="mt-2 w-full rounded-xl border border-white/20 bg-black/30 p-3 text-base text-[rgb(var(--text))] outline-none focus:border-white/35"
                rows={4}
              />
            ) : (
              <ul className="mt-2 list-disc space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 pl-8 text-base leading-relaxed text-[rgb(var(--text)_/_0.9)]">
                {pillar.later.map((item) => (
                  <li key={`${pillar.id}-later-${item}`}>{item}</li>
                ))}
              </ul>
            )}
          </details>
        </section>
      </div>
    </article>
  )
}

export default function PillarsPage() {
  const [pillars, setPillars] = useState<Pillar[]>([])
  const [editMode, setEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch("/api/pillars", { cache: "no-store" })
        const data = (await response.json()) as { pillars?: Pillar[]; error?: string }
        if (!response.ok) throw new Error(data.error || "Failed to load pillars")
        if (!cancelled) setPillars(Array.isArray(data.pillars) ? data.pillars : [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load pillars")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const canSave = useMemo(() => editMode && pillars.length > 0 && !isSaving, [editMode, pillars.length, isSaving])

  const handleSave = async () => {
    setError(null)
    setIsSaving(true)
    try {
      const response = await fetch("/api/pillars", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pillars }),
      })
      const data = (await response.json()) as { pillars?: Pillar[]; error?: string }
      if (!response.ok) throw new Error(data.error || "Failed to save pillars")
      setPillars(Array.isArray(data.pillars) ? data.pillars : pillars)
      setEditMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pillars")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#1f2329] text-[rgb(var(--text))]">
      <div className="mx-auto w-full px-4 py-6 md:px-6 md:py-8">
        <div className="mb-5 flex items-start justify-end gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditMode((prev) => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[rgb(var(--text)_/_0.8)] hover:bg-white/10"
              aria-label={editMode ? "Exit edit mode" : "Enter edit mode"}
              title={editMode ? "Exit edit mode" : "Enter edit mode"}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {editMode && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--text))] hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
            )}
          </div>
        </div>

        {error && <p className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}

        <div className="grid min-h-[calc(100vh-7.5rem)] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((pillar) => (
            <PillarCard
              key={pillar.id}
              pillar={pillar}
              editMode={editMode}
              onChange={(next) => setPillars((prev) => prev.map((item) => (item.id === next.id ? next : item)))}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
