"use client"

import type React from "react"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import PinGate from "../components/PinGate"
import PrivateSectionNav from "../components/PrivateSectionNav"
import { JOURNAL_QUESTION_SET } from "../../lib/journalSchema"
import { formatIsoDateForDisplay, getLocalDateString, normalizeIsoDate } from "../../lib/date"
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Home, Save, Loader2, Search, Compass, FileText, X } from "lucide-react"

type Question = {
  id: string
  key: string
  question_type: "text" | "number" | "rating" | "boolean" | "multiselect" | "date"
  wording: string
  description?: string
  display_order: number
  metadata?: Record<string, any>
}

type Answer = {
  question_key: string
  answer_value: any
  answer_type: string
}

function answerHasValue(value: any) {
  if (value === null || value === undefined || value === "") return false
  if (Array.isArray(value) && value.length === 0) return false
  return true
}

function hasPersistableAnswerValues(sourceAnswers: Record<string, any>) {
  return Object.values(sourceAnswers).some((value) => answerHasValue(value))
}

function serializeAnswers(sourceAnswers: Record<string, any>, questions: Question[]): Answer[] {
  return Object.entries(sourceAnswers)
    .filter(([, value]) => answerHasValue(value))
    .map(([question_key, answer_value]) => {
      const question = questions.find((q) => q.key === question_key)
      return {
        question_key,
        answer_value,
        answer_type: question?.question_type || "text",
      }
    })
}

function JournalPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawDateParam = searchParams.get("date")
  const entrySource = searchParams.get("from")

  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isDraft, setIsDraft] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [loadedEntryExists, setLoadedEntryExists] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateConflict, setDateConflict] = useState<{ date: string; isDraft: boolean } | null>(null)
  const [isChangingEntryDate, setIsChangingEntryDate] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [isEditingSubmitted, setIsEditingSubmitted] = useState(false)

  // Get date for entry (default to today's local date)
  const today = getLocalDateString()
  const entryDate = normalizeIsoDate(rawDateParam) ?? today
  const totalSteps = questions.length + 1
  const isDateStep = currentQuestionIndex === 0
  const currentQuestion = isDateStep ? null : questions[currentQuestionIndex - 1]
  const progress = totalSteps > 0 ? ((currentQuestionIndex + 1) / totalSteps) * 100 : 0
  const isSubmittedReadOnly = loadedEntryExists && !isDraft && !isEditingSubmitted

  useEffect(() => {
    if (rawDateParam == null) return
    if (normalizeIsoDate(rawDateParam)) return
    router.replace(`/journal?date=${today}`)
  }, [rawDateParam, router, today])

  // Load questions on mount
  useEffect(() => {
    async function loadQuestions() {
      try {
        const response = await fetch(`/api/journal/questions?date=${entryDate}`)
        const data = await response.json()
        if (data.questions) {
          setQuestions(data.questions)
        } else {
          setError("Failed to load questions")
        }
      } catch (err) {
        console.error("Failed to load questions:", err)
        setError("Failed to load questions")
      } finally {
        setIsLoading(false)
      }
    }

    loadQuestions()
  }, [entryDate])

  // Reset entry-specific state when date changes before attempting to load entry data
  useEffect(() => {
    setAnswers({})
    setDraftLoaded(false)
    setLoadedEntryExists(false)
    setCurrentQuestionIndex(0)
    setIsDraft(false)
    setError(null)
    setDateConflict(null)
    setShowReview(false)
    setIsEditingSubmitted(false)
  }, [entryDate])

  // Load entry (draft or submitted) on mount
  useEffect(() => {
    async function loadEntry() {
      if (isLoading) return

      try {
        const response = await fetch(`/api/journal/entry?date=${entryDate}`)
        const data = await response.json()
        setLoadedEntryExists(!!data.entry)
        if (data.entry) {
          setIsDraft(data.entry.is_draft)
          setIsEditingSubmitted(false)
          const answersObj: Record<string, any> = {}
          ;(data.answers || []).forEach((a: { question_key: string; answer_value: any }) => {
            if (a.question_key === "day_date") return
            answersObj[a.question_key] = a.answer_value
          })
          setAnswers(answersObj)
        } else {
          setAnswers({})
        }
        setDraftLoaded(true)
      } catch (err) {
        console.error("Failed to load entry:", err)
        setDraftLoaded(true)
      }
    }

    if (!isLoading) loadEntry()
  }, [entryDate, isLoading])

  // Auto-save draft when answers change (debounced)
  useEffect(() => {
    if (!draftLoaded) return // Don't auto-save while loading draft
    if (isSubmittedReadOnly) return
    if (isChangingEntryDate || dateConflict) return

    const hasPersistableAnswers = hasPersistableAnswerValues(answers)
    if (!hasPersistableAnswers) return // Don't create rows for date-only state

    const timer = setTimeout(async () => {
      setIsSaving(true)
      setSaveStatus("saving")

      try {
        const response = await fetch("/api/journal/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: entryDate,
            answers: serializeAnswers(answers, questions),
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setSaveStatus("saved")
          setIsDraft(!!data.draft?.is_draft)
          setLoadedEntryExists(!!data.draft)
          setTimeout(() => setSaveStatus("idle"), 2000) // Hide "saved" after 2 seconds
        } else {
          setSaveStatus("error")
          setTimeout(() => setSaveStatus("idle"), 3000)
        }
      } catch (err) {
        console.error("Failed to save draft:", err)
        setSaveStatus("error")
        setTimeout(() => setSaveStatus("idle"), 3000)
      } finally {
        setIsSaving(false)
      }
    }, 500) // 500ms debounce

    return () => clearTimeout(timer)
  }, [answers, entryDate, questions, draftLoaded, isChangingEntryDate, dateConflict, isSubmittedReadOnly])

  const handleAnswerChange = (questionKey: string, value: any) => {
    if (isSubmittedReadOnly) return
    setAnswers((prev) => ({
      ...prev,
      [questionKey]: value,
    }))
  }

  const handleEntryDateChange = async (value: string) => {
    if (isSubmittedReadOnly) return
    setDateConflict(null)

    const nextDate = normalizeIsoDate(value)
    if (!nextDate || nextDate === entryDate) return

    setIsChangingEntryDate(true)
    setError(null)

    try {
      const existsResponse = await fetch(`/api/journal/exists?date=${nextDate}`, { cache: "no-store" })
      const existsData = await existsResponse.json()
      if (existsResponse.ok && existsData.exists) {
        setDateConflict({ date: nextDate, isDraft: !!existsData.is_draft })
        return
      }

      if (loadedEntryExists) {
        const moveResponse = await fetch("/api/journal/entry", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromDate: entryDate, toDate: nextDate }),
        })

        if (!moveResponse.ok) {
          const data = await moveResponse.json()
          if (moveResponse.status === 409) {
            setDateConflict({ date: nextDate, isDraft: false })
            return
          }
          setError(data.error || "Failed to change entry date")
          return
        }
      }

      if (hasPersistableAnswerValues(answers)) {
        const saveResponse = await fetch("/api/journal/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: nextDate,
            answers: serializeAnswers(answers, questions),
          }),
        })

        if (!saveResponse.ok) {
          const data = await saveResponse.json()
          setError(data.error || "Failed to save answers under the new date")
          return
        }
      }

      router.replace(`/journal?date=${nextDate}`)
    } catch (err) {
      console.error("Failed to change entry date:", err)
      setError("Failed to change entry date. Please try again.")
    } finally {
      setIsChangingEntryDate(false)
    }
  }

  const handleNext = () => {
    if (currentQuestionIndex < totalSteps - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/journal/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: entryDate,
          answers: serializeAnswers(answers, questions),
        }),
      })

      if (response.ok) {
        if (entrySource === "calendar") {
          router.push(`/journal/calendar?submitted=${entryDate}`)
        } else {
          router.push("/dashboard")
        }
      } else {
        const data = await response.json()
        setError(data.error || "Failed to submit entry")
      }
    } catch (err) {
      console.error("Failed to submit entry:", err)
      setError("Failed to submit entry. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderEntryDateStep = () => (
    <div className="space-y-4">
      <input
        type="date"
        value={entryDate}
        onChange={(e) => void handleEntryDateChange(e.target.value)}
        disabled={isChangingEntryDate || isSubmittedReadOnly}
        className="w-full px-4 py-3 border-2 border-slate-700 bg-slate-900 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:opacity-60"
      />
      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-300">
        <p>
          Saved as <span className="font-medium text-slate-100">{formatIsoDateForDisplay(entryDate)}</span>.
          Created and edited timestamps are tracked separately.
        </p>
      </div>
      {isChangingEntryDate && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking date...</span>
        </div>
      )}
      {dateConflict && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/40 p-4 text-sm text-amber-100">
          <p className="font-medium">An entry already exists for {formatIsoDateForDisplay(dateConflict.date)}.</p>
          <p className="mt-1 text-amber-200/80">
            Open that {dateConflict.isDraft ? "draft" : "entry"} or choose a different date.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.replace(`/journal?date=${dateConflict.date}`)}
              className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400"
            >
              Open existing
            </button>
            <button
              type="button"
              onClick={() => setDateConflict(null)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Keep current date
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const renderQuestionInput = (question: Question) => {
    const value = answers[question.key] || ""

    switch (question.question_type) {
      case "rating":
      case "number": {
        const min = question.metadata?.min ?? (question.question_type === "rating" ? 1 : 0)
        const max = question.metadata?.max ?? (question.question_type === "rating" ? 10 : 100)
        const step = question.metadata?.step ?? (question.question_type === "rating" ? 0.5 : 1)

        return (
          <div className="space-y-4">
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => handleAnswerChange(question.key, parseFloat(e.target.value) || min)}
              className="w-full px-4 py-3 text-2xl font-semibold text-center border-2 border-slate-700 bg-slate-900 text-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder={`${min}-${max}`}
            />
            {question.question_type === "rating" && (
              <div className="flex justify-between text-sm text-slate-400 px-2">
                <span>{min}</span>
                <span>{max}</span>
              </div>
            )}
            {question.metadata?.step && (
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value || min}
                onChange={(e) => handleAnswerChange(question.key, parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            )}
          </div>
        )
      }

      case "text":
        return (
          <textarea
            value={value}
            onChange={(e) => handleAnswerChange(question.key, e.target.value)}
            rows={6}
            className="w-full px-4 py-3 border-2 border-slate-700 bg-slate-900 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none placeholder:text-slate-500"
            placeholder="Type your answer here..."
          />
        )

      case "boolean":
        return (
          <div className="flex gap-4 justify-center">
            <button
              type="button"
              onClick={() => handleAnswerChange(question.key, true)}
              className={`px-8 py-4 rounded-xl font-semibold transition-all ${
                value === true
                  ? "bg-green-500 text-white shadow-lg scale-105"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => handleAnswerChange(question.key, false)}
              className={`px-8 py-4 rounded-xl font-semibold transition-all ${
                value === false
                  ? "bg-red-500 text-white shadow-lg scale-105"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              No
            </button>
          </div>
        )

      case "date":
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleAnswerChange(question.key, e.target.value)}
            className="w-full px-4 py-3 border-2 border-slate-700 bg-slate-900 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
        )

      case "multiselect": {
        let options: string[] = []
        const metadata = question.metadata as unknown
        if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
          const rawOptions = (metadata as { options?: unknown }).options
          if (Array.isArray(rawOptions)) {
            options = rawOptions.filter((opt): opt is string => typeof opt === "string")
          }
        } else if (typeof metadata === "string") {
          try {
            const parsed = JSON.parse(metadata) as { options?: unknown }
            if (Array.isArray(parsed?.options)) {
              options = parsed.options.filter((opt): opt is string => typeof opt === "string")
            }
          } catch {
            options = []
          }
        }

        const selectedValues = Array.isArray(value) ? value : []

        return (
          <div className="space-y-2">
            {options.map((option: string) => (
              <label
                key={option}
                className="flex items-center gap-3 p-3 border-2 border-slate-700 rounded-xl hover:bg-slate-800 cursor-pointer transition-all bg-slate-900"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, option]
                      : selectedValues.filter((v) => v !== option)
                    handleAnswerChange(question.key, newValues)
                  }}
                  className="w-5 h-5 text-purple-400 rounded focus:ring-purple-500 bg-slate-900 border-slate-600"
                />
                <span className="text-lg text-slate-100">{option}</span>
              </label>
            ))}
          </div>
        )
      }

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleAnswerChange(question.key, e.target.value)}
            className="w-full px-4 py-3 border-2 border-slate-700 bg-slate-900 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-500"
            placeholder="Type your answer here..."
          />
        )
    }
  }

  if (isLoading) {
    return (
      <PinGate>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-4" />
            <p className="text-slate-300">Loading journal...</p>
          </div>
        </div>
      </PinGate>
    )
  }

  if (error && questions.length === 0) {
    return (
      <PinGate>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <p className="text-red-400 mb-4">{error}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Journal
            </Link>
          </div>
        </div>
      </PinGate>
    )
  }

  if (questions.length === 0) {
    return (
      <PinGate>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <p className="text-slate-300 mb-4">No questions available.</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Journal
            </Link>
          </div>
        </div>
      </PinGate>
    )
  }

  const answeredCount = 1 + Object.keys(answers).filter((key) => {
    const value = answers[key]
    return value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)
  }).length

  const currentAppKeys = new Set(JOURNAL_QUESTION_SET.map((q) => q.key))
  const answerKeysWithValues = Object.entries(answers).filter(([, value]) => {
    if (value === null || value === undefined || value === "") return false
    if (Array.isArray(value) && value.length === 0) return false
    return true
  })
  const isLegacyEntry =
    loadedEntryExists &&
    answerKeysWithValues.length > 0 &&
    answerKeysWithValues.some(([key]) => !currentAppKeys.has(key))
  const reviewAnswers = serializeAnswers(answers, questions)

  return (
    <PinGate>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        {/* Header */}
        <div className="bg-slate-950/80 backdrop-blur-sm border-b border-slate-800/60 sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-6 py-4">
            <PrivateSectionNav className="mb-3" />
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-slate-300 hover:text-slate-50 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="font-medium">Back</span>
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                >
                  <Home className="w-3.5 h-3.5" /> Home
                </Link>
                <div className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
                  Entry for <span className="font-medium text-slate-100">{formatIsoDateForDisplay(entryDate)}</span>
                </div>
                <Link
                  href="/journal/search"
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-purple-400 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  Search
                </Link>
                <Link
                  href="/journal/explorer"
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-purple-400 transition-colors"
                >
                  <Compass className="w-4 h-4" />
                  Explorer
                </Link>
                <Link
                  href="/journal/calendar"
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-purple-400 transition-colors"
                >
                  <CalendarDays className="w-4 h-4" />
                  Calendar
                </Link>
              </div>
              <div className="flex items-center gap-3">
                {saveStatus === "saving" && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                )}
                {saveStatus === "saved" && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <Save className="w-4 h-4" />
                    <span>{isDraft ? "Draft saved" : "Changes saved"}</span>
                  </div>
                )}
                {saveStatus === "error" && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <span>Save failed</span>
                  </div>
                )}
                {isDraft && saveStatus === "idle" && (
                  <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    Draft
                  </div>
                )}
              </div>
            </div>
            {/* Progress bar — hide for legacy read-only */}
            {!isLegacyEntry && (
              <>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                  <span>Step {currentQuestionIndex + 1} of {totalSteps}</span>
                  <span>{answeredCount} answered</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-950/40 border border-red-700/60 rounded-xl text-red-200">
              {error}
            </div>
          )}

          {draftLoaded && loadedEntryExists && (
            <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-700/60 bg-sky-950/40 p-4 text-sky-200 transition-opacity duration-200 ${isSaving ? "opacity-0" : "opacity-100"}`}>
              <div>
                {isDraft
                  ? `Resuming your draft from ${formatIsoDateForDisplay(entryDate)}`
                  : isEditingSubmitted
                    ? `Editing submitted entry from ${formatIsoDateForDisplay(entryDate)}`
                    : `Viewing submitted entry from ${formatIsoDateForDisplay(entryDate)}`}
              </div>
              {!isDraft && !isEditingSubmitted && (
                <button
                  type="button"
                  onClick={() => setIsEditingSubmitted(true)}
                  className="rounded-lg border border-sky-600 px-3 py-2 text-sm font-medium text-sky-100 hover:bg-sky-900/60"
                >
                  Edit submitted entry
                </button>
              )}
            </div>
          )}

          {/* Read-only view for legacy / different-question-set entries */}
          {isLegacyEntry && (
            <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-900/80 shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
                <h2 className="text-lg font-semibold text-slate-100">
                  View only — {formatIsoDateForDisplay(entryDate)}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  This entry was imported or uses a different question set. Showing all answers.
                </p>
              </div>
              <ul className="divide-y divide-slate-700">
                {answerKeysWithValues.map(([key, value]) => {
                  const wording = questions.find((q) => q.key === key)?.wording || key
                  const displayValue = Array.isArray(value) ? value.join(", ") : String(value)
                  return (
                    <li key={key} className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-400 mb-1">{wording}</div>
                      <div className="text-slate-100 whitespace-pre-wrap break-words">{displayValue}</div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Date step + question card (current form) — hide when showing legacy read-only */}
          {!isLegacyEntry && (
            <div className="bg-slate-900 rounded-2xl shadow-xl shadow-black/40 border border-slate-800 p-8 mb-6">
              <h2 className="text-2xl font-bold text-slate-50 mb-2">
                {isDateStep ? "What day is this entry for?" : currentQuestion?.wording}
              </h2>
              {isDateStep ? (
                <p className="text-slate-300 mb-8">
                  This controls which journal entry is loaded and where this entry is saved.
                </p>
              ) : currentQuestion?.description ? (
                <p className="text-slate-300 mb-8">{currentQuestion.description}</p>
              ) : null}

              <div className="mt-6">
                {isDateStep ? renderEntryDateStep() : currentQuestion ? renderQuestionInput(currentQuestion) : null}
              </div>
            </div>
          )}

          {/* Navigation — hide for legacy read-only */}
          {!isLegacyEntry && (
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 border-2 border-slate-700 rounded-xl font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>

            {currentQuestionIndex === totalSteps - 1 ? (
              <button
                onClick={() => setShowReview(true)}
                disabled={isSubmitting || !!dateConflict || isChangingEntryDate || isSubmittedReadOnly}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    {isSubmittedReadOnly ? "View Only" : "Review Entry"}
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-400 hover:to-indigo-400 transition-all shadow-md hover:shadow-lg"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
          )}
        </div>

        {showReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-700 px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-50">Review entry</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatIsoDateForDisplay(entryDate)} · {reviewAnswers.length} answered
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReview(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  aria-label="Close review"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
                {reviewAnswers.length === 0 ? (
                  <p className="text-sm text-slate-400">No journal answers yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {reviewAnswers.map((answer) => {
                      const question = questions.find((q) => q.key === answer.question_key)
                      const displayValue = Array.isArray(answer.answer_value)
                        ? answer.answer_value.join(", ")
                        : String(answer.answer_value)

                      return (
                        <li key={answer.question_key} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                          <div className="mb-1 text-sm font-medium text-slate-400">
                            {question?.wording || answer.question_key}
                          </div>
                          <div className="whitespace-pre-wrap break-words text-slate-100">{displayValue}</div>
                        </li>
                      )
                    })}
                  </ul>
              )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-700 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowReview(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 font-medium text-slate-200 hover:bg-slate-800"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  Submit Entry
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PinGate>
  )
}

export default function JournalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
        </div>
      }
    >
      <JournalPageContent />
    </Suspense>
  )
}
