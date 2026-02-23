"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, MessageCircle, Send } from "lucide-react"

type Question = {
  id: string
  content: string
  author_label: string | null
  response: string | null
  created_at: string
  responded_at: string | null
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [content, setContent] = useState("")
  const [authorLabel, setAuthorLabel] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [thankYou, setThankYou] = useState("")
  const [error, setError] = useState("")
  const [activeResponseId, setActiveResponseId] = useState<string | null>(null)
  const [responsePin, setResponsePin] = useState("")
  const [responseText, setResponseText] = useState("")
  const [responding, setResponding] = useState(false)

  useEffect(() => {
    void fetchQuestions(true)

    const intervalId = window.setInterval(() => {
      void fetchQuestions(false)
    }, 20000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const fetchQuestions = async (showLoader = false) => {
    if (showLoader) setLoading(true)

    try {
      const res = await fetch("/api/questions", { cache: "no-store" })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to load questions")
      }

      setQuestions(data.questions || [])
    } catch (err) {
      console.error("Failed to load questions:", err)
      setError(err instanceof Error ? err.message : "Failed to load questions")
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  const submitQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return

    setSubmitting(true)
    setError("")
    setThankYou("")

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          author_label: authorLabel.trim() || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit")
      }

      setContent("")
      setAuthorLabel("")
      setThankYou("Thanks, your message is in.")
      await fetchQuestions(false)
    } catch (err) {
      console.error("Failed to submit question:", err)
      setError(err instanceof Error ? err.message : "Failed to submit")
    } finally {
      setSubmitting(false)
    }
  }

  const submitResponse = async (id: string, e: React.FormEvent) => {
    e.preventDefault()
    if (!responsePin || !responseText.trim() || responding) return

    setResponding(true)
    setError("")

    try {
      const res = await fetch(`/api/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: responsePin, response: responseText.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to respond")
      }

      setResponsePin("")
      setResponseText("")
      setActiveResponseId(null)
      await fetchQuestions(false)
    } catch (err) {
      console.error("Failed to respond:", err)
      setError(err instanceof Error ? err.message : "Failed to respond")
    } finally {
      setResponding(false)
    }
  }

  const formatRelativeTime = (iso: string) => {
    const timestamp = new Date(iso).getTime()
    const now = Date.now()
    const diffSeconds = Math.max(1, Math.floor((now - timestamp) / 1000))

    if (diffSeconds < 60) return `${diffSeconds} seconds ago`

    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`

    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/" className="p-2 rounded-xl hover:bg-[rgb(var(--surface-2))] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[rgb(var(--text-muted))]" />
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[rgb(var(--text))]">
              Questions & Advice for Zach
            </h1>
            <p className="text-[rgb(var(--text-muted))] mt-1">Got a question or advice? Drop it below. Zach reads everything.</p>
          </div>
        </div>

        <div className="bg-[rgb(var(--surface-2)_/_0.50)] border border-[rgb(var(--border))] rounded-3xl p-6 mb-8 ">
          <div className="flex items-center gap-3 mb-4">
            <MessageCircle className="w-5 h-5 text-[rgb(var(--brand))]" />
            <h2 className="text-lg font-semibold text-[rgb(var(--text))]">Submit a question</h2>
          </div>

          <form onSubmit={submitQuestion} className="space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Your question or advice..."
              required
              rows={5}
              className="w-full rounded-2xl bg-[rgb(var(--surface)_/_0.70)] border border-[rgb(var(--border))] px-4 py-3 text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
            />
            <input
              value={authorLabel}
              onChange={(e) => setAuthorLabel(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full rounded-2xl bg-[rgb(var(--surface)_/_0.70)] border border-[rgb(var(--border))] px-4 py-3 text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!content.trim() || submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-50 disabled:cursor-not-allowed text-[rgb(var(--text))] font-medium transition-colors"
              >
                <Send className="w-4 h-4" />
                {submitting ? "Submitting..." : "Submit"}
              </button>
              {thankYou && <p className="text-[rgb(var(--brand))] text-sm">{thankYou}</p>}
            </div>
          </form>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-[rgb(127_29_29)] bg-[rgb(127_29_29_/_0.35)] px-4 py-3 text-[rgb(239_68_68)] text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="text-[rgb(var(--text-muted))]">Loading questions...</div>
          ) : (
            questions.map((question) => (
              <article key={question.id} className="bg-[rgb(var(--surface-2)_/_0.50)] border border-[rgb(var(--border))] rounded-3xl p-5 ">
                <p className="text-[rgb(var(--text))] whitespace-pre-wrap leading-relaxed">{question.content}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-[rgb(var(--text-muted))]">
                  <span>{question.author_label || "Anonymous"}</span>
                  <span>•</span>
                  <span>{formatRelativeTime(question.created_at)}</span>
                </div>

                {question.response && (
                  <div className="mt-4 rounded-2xl border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.7)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--brand))] mb-2">Zach&apos;s response</p>
                    <p className="text-[rgb(var(--text))] whitespace-pre-wrap">{question.response}</p>
                  </div>
                )}

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeResponseId === question.id) {
                        setActiveResponseId(null)
                        setResponsePin("")
                        setResponseText("")
                      } else {
                        setActiveResponseId(question.id)
                        setResponsePin("")
                        setResponseText("")
                      }
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2)_/_0.8)] transition-colors"
                  >
                    Respond
                  </button>
                </div>

                {activeResponseId === question.id && (
                  <form onSubmit={(e) => submitResponse(question.id, e)} className="mt-4 space-y-3">
                    <input
                      type="password"
                      value={responsePin}
                      onChange={(e) => setResponsePin(e.target.value)}
                      placeholder="PIN"
                      required
                      className="w-full rounded-xl bg-[rgb(var(--surface)_/_0.70)] border border-[rgb(var(--border))] px-3 py-2 text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
                    />
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Write Zach's response..."
                      rows={3}
                      required
                      className="w-full rounded-xl bg-[rgb(var(--surface)_/_0.70)] border border-[rgb(var(--border))] px-3 py-2 text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]"
                    />
                    <button
                      type="submit"
                      disabled={responding}
                      className="px-4 py-2 text-sm rounded-xl bg-[rgb(var(--brand))] hover:bg-[rgb(var(--brand-strong))] disabled:opacity-50 disabled:cursor-not-allowed text-[rgb(var(--text))] font-medium"
                    >
                      {responding ? "Saving..." : "Save response"}
                    </button>
                  </form>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
