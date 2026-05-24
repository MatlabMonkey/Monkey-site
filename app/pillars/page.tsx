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
  return (
    <article
      className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5 transition-transform duration-200 hover:-translate-y-0.5"
      style={{ borderTop: `3px solid ${pillar.color}` }}
    >
      <h2 className="text-2xl font-semibold text-[rgb(var(--text))]">{pillar.title}</h2>

      <div className="mt-4 space-y-4">
        <section>
          <h3 className="text-xs uppercase tracking-wide text-[rgb(var(--text)_/_0.68)]">Active focus</h3>
          {editMode ? (
            <textarea
              value={pillar.active_focus}
              onChange={(e) => onChange({ ...pillar, active_focus: e.target.value })}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 p-2.5 text-sm text-[rgb(var(--text))] outline-none focus:border-white/30"
              rows={3}
            />
          ) : (
            <p className="mt-2 text-sm text-[rgb(var(--text)_/_0.92)]">{pillar.active_focus}</p>
          )}
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wide text-[rgb(var(--text)_/_0.68)]">Do</h3>
          {editMode ? (
            <textarea
              value={toMultiline(pillar.dos)}
              onChange={(e) => onChange({ ...pillar, dos: splitLines(e.target.value) })}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 p-2.5 text-sm text-[rgb(var(--text))] outline-none focus:border-white/30"
              rows={4}
            />
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[rgb(var(--text)_/_0.9)]">
              {pillar.dos.map((item) => (
                <li key={`${pillar.id}-do-${item}`}>{item}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wide text-[rgb(var(--text)_/_0.68)]">Don’t</h3>
          {editMode ? (
            <textarea
              value={toMultiline(pillar.donts)}
              onChange={(e) => onChange({ ...pillar, donts: splitLines(e.target.value) })}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 p-2.5 text-sm text-[rgb(var(--text))] outline-none focus:border-white/30"
              rows={4}
            />
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[rgb(var(--text)_/_0.9)]">
              {pillar.donts.map((item) => (
                <li key={`${pillar.id}-dont-${item}`}>{item}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wide text-[rgb(var(--text)_/_0.68)]">Quality Standard</h3>
          {editMode ? (
            <textarea
              value={pillar.quality_standard}
              onChange={(e) => onChange({ ...pillar, quality_standard: e.target.value })}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 p-2.5 text-sm text-[rgb(var(--text))] outline-none focus:border-white/30"
              rows={3}
            />
          ) : (
            <p className="mt-2 text-sm text-[rgb(var(--text)_/_0.92)]">{pillar.quality_standard}</p>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <details>
            <summary className="cursor-pointer select-none text-xs uppercase tracking-wide text-[rgb(var(--text)_/_0.65)]">Later</summary>
            {editMode ? (
              <textarea
                value={toMultiline(pillar.later)}
                onChange={(e) => onChange({ ...pillar, later: splitLines(e.target.value) })}
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 p-2.5 text-sm text-[rgb(var(--text))] outline-none focus:border-white/30"
                rows={4}
              />
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[rgb(var(--text)_/_0.8)]">
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
    <main className="min-h-screen bg-[#05070B] text-[rgb(var(--text))]">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-6 md:py-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Pillars</h1>
            <p className="mt-2 text-sm text-[rgb(var(--text)_/_0.72)]">One active focus per pillar. Everything else goes to Later.</p>
          </div>

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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
