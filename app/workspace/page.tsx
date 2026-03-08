"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Lightbulb, PlusCircle, LockKeyhole, Archive, Users } from "lucide-react"
import PinGate from "../components/PinGate"

type IdeasSummary = {
  total: number
  pinned: number
}

export default function WorkspacePage() {
  const [summary, setSummary] = useState<IdeasSummary>({ total: 0, pinned: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/ideas?archived=false&limit=300", { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) return

        const ideas = Array.isArray(data.ideas) ? data.ideas : []
        const pinned = ideas.filter((idea: { pinned?: boolean }) => idea.pinned).length
        setSummary({ total: ideas.length, pinned })
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return (
    <PinGate>
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/" className="p-2 rounded-xl hover:bg-[rgb(var(--surface-2))] transition-colors">
              <ArrowLeft className="w-5 h-5 text-[rgb(var(--text-muted))]" />
            </Link>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Workspace</h1>
              <p className="text-[rgb(var(--text-muted))] mt-1">Quick capture and idea triage.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-5">
              <div className="flex items-center gap-2 mb-2 text-[rgb(var(--brand))]">
                <Lightbulb className="w-4 h-4" />
                <span className="text-sm">Active ideas</span>
              </div>
              <p className="text-3xl font-semibold">{loading ? "-" : summary.total}</p>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-5">
              <div className="flex items-center gap-2 mb-2 text-[rgb(var(--brand))]">
                <PlusCircle className="w-4 h-4" />
                <span className="text-sm">Pinned</span>
              </div>
              <p className="text-3xl font-semibold">{loading ? "-" : summary.pinned}</p>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.7)] p-5">
              <div className="flex items-center gap-2 mb-2 text-[rgb(var(--brand))]">
                <LockKeyhole className="w-4 h-4" />
                <span className="text-sm">Access</span>
              </div>
              <p className="text-sm text-[rgb(var(--text-muted))]">PIN-protected local access</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.60)] p-6">
              <h2 className="text-xl font-semibold mb-2">Capture pipeline</h2>
              <p className="text-[rgb(var(--text-muted))] mb-6">
                Apple Shortcuts can post to <code className="font-mono">/api/capture</code> using <code className="font-mono">CAPTURE_API_KEY</code>.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/workspace/ideas"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgb(var(--brand))] text-[rgb(var(--text))] hover:bg-[rgb(var(--brand-strong))] transition-colors"
                >
                  <Lightbulb className="w-4 h-4" />
                  Open Ideas
                </Link>
                <Link
                  href="/workspace/ideas?archived=true"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface)_/_0.7)] transition-colors"
                >
                  <Archive className="w-4 h-4" />
                  View Archived
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.60)] p-6">
              <div className="flex items-center gap-2 mb-2 text-[rgb(var(--brand))]">
                <Users className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Contacts</h2>
              </div>
              <p className="text-[rgb(var(--text-muted))] mb-6">
                Capture people you meet with AI-powered extraction and semantic search.
              </p>
              <Link
                href="/workspace/contacts"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgb(var(--brand))] text-[rgb(var(--text))] hover:bg-[rgb(var(--brand-strong))] transition-colors"
              >
                <Users className="w-4 h-4" />
                Open Contacts
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PinGate>
  )
}
