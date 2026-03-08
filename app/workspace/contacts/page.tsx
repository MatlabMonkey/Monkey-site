"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Building2, Plus, Search, UserRound } from "lucide-react"
import PinGate from "../../components/PinGate"
import type { ContactSearchResult } from "../../../lib/contacts"

type SearchApiResponse = {
  results?: ContactSearchResult[]
  error?: string
}

type ListApiResponse = {
  contacts?: ContactSearchResult[]
  error?: string
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export default function ContactsPage() {
  const [query, setQuery] = useState("")
  const [contacts, setContacts] = useState<ContactSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const abortController = new AbortController()
    const delay = query.trim() ? 300 : 0

    const run = async () => {
      setLoading(true)
      setError("")

      try {
        if (query.trim()) {
          const res = await fetch("/api/contacts/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query.trim(), limit: 40 }),
            signal: abortController.signal,
          })

          const data = (await res.json()) as SearchApiResponse
          if (!res.ok) {
            throw new Error(data.error || "Failed to search contacts")
          }

          setContacts(Array.isArray(data.results) ? data.results : [])
          return
        }

        const res = await fetch("/api/contacts?limit=80", {
          cache: "no-store",
          signal: abortController.signal,
        })
        const data = (await res.json()) as ListApiResponse
        if (!res.ok) {
          throw new Error(data.error || "Failed to load contacts")
        }

        setContacts(Array.isArray(data.contacts) ? data.contacts : [])
      } catch (nextError) {
        if (abortController.signal.aborted) return
        setError(getErrorMessage(nextError, "Failed to load contacts"))
        setContacts([])
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      void run()
    }, delay)

    return () => {
      window.clearTimeout(timeoutId)
      abortController.abort()
    }
  }, [query])

  return (
    <PinGate>
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/workspace" className="rounded-xl p-2 transition-colors hover:bg-[rgb(var(--surface-2))]">
              <ArrowLeft className="h-5 w-5 text-[rgb(var(--text-muted))]" />
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold md:text-4xl">Contacts</h1>
            </div>
            <Link
              href="/workspace/contacts/capture"
              className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--brand))] px-4 py-2 text-sm font-medium transition-colors hover:bg-[rgb(var(--brand-strong))]"
            >
              <Plus className="h-4 w-4" />
              Add Contact
            </Link>
          </div>

          <div className="mb-6 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-6">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--text-muted))]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search contacts..."
                className="w-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
              />
            </label>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-[rgb(127_29_29)] bg-[rgb(127_29_29_/_0.3)] p-4 text-sm text-[rgb(248_113_113)]">
              {error}
            </div>
          )}

          {loading && <p className="text-sm text-[rgb(var(--text-muted))]">Loading contacts...</p>}

          {!loading && contacts.length === 0 && (
            <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-8 text-center text-[rgb(var(--text-muted))]">
              No contacts yet. Add your first contact.
            </div>
          )}

          {!loading && contacts.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {contacts.map((contact) => (
                <Link
                  key={contact.id}
                  href={`/workspace/contacts/${contact.id}`}
                  className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.75)] p-6 transition-colors hover:border-[rgb(var(--brand))]"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold">{contact.name || "Unnamed contact"}</h2>
                    <UserRound className="mt-0.5 h-4 w-4 text-[rgb(var(--text-muted))]" />
                  </div>
                  <div className="space-y-1.5 text-sm text-[rgb(var(--text-muted))]">
                    <p>{contact.job_title || "No job title"}</p>
                    <p className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{contact.company || "No company"}</span>
                    </p>
                    <p>{contact.where_met ? `Met at: ${contact.where_met}` : "Where met not captured"}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {contact.tags.length > 0 ? (
                      contact.tags.map((tag) => (
                        <span
                          key={`${contact.id}-${tag}`}
                          className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.8)] px-2.5 py-1 text-xs text-[rgb(var(--text-muted))]"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[rgb(var(--text-muted))]">No tags</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PinGate>
  )
}
