"use client"

import Link from "next/link"
import { ArrowLeft, Archive, Home, Lightbulb, Users } from "lucide-react"
import PinGate from "../components/PinGate"
import PrivateSectionNav from "../components/PrivateSectionNav"

export default function WorkspacePage() {
  return (
    <PinGate>
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Link href="/" className="p-2 rounded-xl hover:bg-[rgb(var(--surface-2))] transition-colors">
                <ArrowLeft className="w-5 h-5 text-[rgb(var(--text-muted))]" />
              </Link>
              <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2)_/_0.75)]">
                <Home className="w-3.5 h-3.5" /> Home
              </Link>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Workspace</h1>
              <p className="text-[rgb(var(--text-muted))] mt-1">Capture and organize what matters.</p>
              <PrivateSectionNav className="mt-3" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.60)] p-6">
              <h2 className="text-xl font-semibold mb-2">Idea Inbox</h2>
              <p className="text-[rgb(var(--text-muted))] mb-6">
                Quickly capture thoughts, then archive what you don&apos;t need.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/workspace/ideas"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgb(var(--brand))] text-[rgb(var(--text))] hover:bg-[rgb(var(--brand-strong))] transition-colors"
                >
                  <Lightbulb className="w-4 h-4" />
                  Open Idea Inbox
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
