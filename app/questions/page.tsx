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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/" className="p-2 rounded-xl hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-200 via-slate-200 to-blue-100 bg-clip-text text-transparent">
              Questions & Advice for Zach
            </h1>
            <p className="text-gray-400 mt-1">Got a question or advice? Drop it below. Zach reads everything.</p>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700/50 rounded-3xl p-6 mb-8 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <MessageCircle className="w-5 h-5 text-sky-300" />
            <h2 className="text-lg font-semibold text-white">Submit a question</h2>
          </div>

          <form onSubmit={submitQuestion} className="space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Your question or advice..."
              required
              rows={5}
              className="w-full rounded-2xl bg-gray-900/70 border border-gray-700 px-4 py-3 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <input
              value={authorLabel}
              onChange={(e) => setAuthorLabel(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full rounded-2xl bg-gray-900/70 border border-gray-700 px-4 py-3 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!content.trim() || submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                <Send className="w-4 h-4" />
                {submitting ? "Submitting..." : "Submit"}
              </button>
              {thankYou && <p className="text-green-400 text-sm">{thankYou}</p>}
            </div>
          </form>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="text-gray-400">Loading questions...</div>
          ) : (
            questions.map((question) => (
              <article key={question.id} className="bg-gray-800/50 border border-gray-700/50 rounded-3xl p-5 shadow-lg">
                <p className="text-gray-100 whitespace-pre-wrap leading-relaxed">{question.content}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  <span>{question.author_label || "Anonymous"}</span>
                  <span>•</span>
                  <span>{formatRelativeTime(question.created_at)}</span>
                </div>

                {question.response && (
                  <div className="mt-4 rounded-2xl border border-sky-800/40 bg-sky-950/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-300 mb-2">Zach&apos;s response</p>
                    <p className="text-sky-100 whitespace-pre-wrap">{question.response}</p>
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
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700/60 transition-colors"
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
                      className="w-full rounded-xl bg-gray-900/70 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Write Zach's response..."
                      rows={3}
                      required
                      className="w-full rounded-xl bg-gray-900/70 border border-gray-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="submit"
                      disabled={responding}
                      className="px-4 py-2 text-sm rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium"
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
