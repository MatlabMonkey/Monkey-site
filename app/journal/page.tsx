"use client"

import type React from "react"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import PinGate from "../components/PinGate"
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Save, Loader2, Search } from "lucide-react"

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

function JournalPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get("date")

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

  // Get date for entry (default to today)
  const entryDate = dateParam || new Date().toISOString().split("T")[0]
  const currentQuestion = questions[currentQuestionIndex]
  const totalQuestions = questions.length
  const progress = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0

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

  // Load entry (draft or submitted) on mount
  useEffect(() => {
    async function loadEntry() {
      if (isLoading) return

      try {
        const response = await fetch(`/api/journal/entry?date=${entryDate}`)
        const data = await response.json()
        if (data.entry) {
          setIsDraft(data.entry.is_draft)
          const answersObj: Record<string, any> = {}
          ;(data.answers || []).forEach((a: { question_key: string; answer_value: any }) => {
            answersObj[a.question_key] = a.answer_value
          })
          setAnswers(answersObj)
        }
        setDraftLoaded(true)
      } catch (err) {
        console.error("Failed to load entry:", err)
        setDraftLoaded(true)
      }
    }

    if (!isLoading) loadEntry()
  }, [entryDate, isLoading])

  // Pre-fill day_date from entry date when starting a new entry
  useEffect(() => {
    if (!draftLoaded || loadedEntryExists) return
    if (answers.day_date != null && answers.day_date !== "") return
    setAnswers((prev) => ({ ...prev, day_date: entryDate }))
  }, [draftLoaded, loadedEntryExists, entryDate, answers.day_date])

  // Auto-save draft when answers change (debounced)
  useEffect(() => {
    if (!draftLoaded) return // Don't auto-save while loading draft
    if (Object.keys(answers).length === 0) return // Don't save empty answers

    const timer = setTimeout(async () => {
      setIsSaving(true)
      setSaveStatus("saving")

      try {
        // Convert answers object to array format
        const answersArray: Answer[] = Object.entries(answers)
          .filter(([_, value]) => value !== null && value !== undefined && value !== "")
          .map(([question_key, answer_value]) => {
            // Find question to get answer_type
            const question = questions.find((q) => q.key === question_key)
            return {
              question_key,
              answer_value,
              answer_type: question?.question_type || "text",
            }
          })

        const response = await fetch("/api/journal/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: entryDate,
            answers: answersArray,
          }),
        })

        if (response.ok) {
          setSaveStatus("saved")
          setIsDraft(true)
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
  }, [answers, entryDate, questions, draftLoaded])

  const handleAnswerChange = (questionKey: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionKey]: value,
    }))
  }

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
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
      // Convert answers object to array format
      const answersArray: Answer[] = Object.entries(answers)
        .filter(([_, value]) => value !== null && value !== undefined && value !== "")
        .map(([question_key, answer_value]) => {
          const question = questions.find((q) => q.key === question_key)
          return {
            question_key,
            answer_value,
            answer_type: question?.question_type || "text",
          }
        })

      const response = await fetch("/api/journal/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: entryDate,
          answers: answersArray,
        }),
      })

      if (response.ok) {
        // Redirect to dashboard on success
        router.push("/dashboard")
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

      case "multiselect":
        const options = question.metadata?.options || []
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

  const answeredCount = Object.keys(answers).filter((key) => {
    const value = answers[key]
    return value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)
  }).length

  return (
    <PinGate>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        {/* Header */}
        <div className="bg-slate-950/80 backdrop-blur-sm border-b border-slate-800/60 sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-slate-300 hover:text-slate-50 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="font-medium">Back</span>
                </Link>
                <label className="flex items-center gap-2 text-slate-300">
                  <span className="text-sm font-medium">Entry date:</span>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => router.replace(`/journal?date=${e.target.value}`)}
                    className="px-3 py-1.5 border border-slate-700 rounded-lg bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </label>
                <Link
                  href="/journal/search"
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-purple-400 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  Search
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
                    <span>Draft saved</span>
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
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
              <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
              <span>{answeredCount} answered</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-950/40 border border-red-700/60 rounded-xl text-red-200">
              {error}
            </div>
          )}

          {draftLoaded && loadedEntryExists && !isSaving && (
            <div className="mb-6 p-4 rounded-xl border border-sky-700/60 bg-sky-950/40 text-sky-200">
              {isDraft
                ? `Resuming your draft from ${new Date(entryDate).toLocaleDateString()}`
                : `Editing submitted entry from ${new Date(entryDate).toLocaleDateString()}`}
            </div>
          )}

          {/* Question Card */}
          {currentQuestion && (
            <div className="bg-slate-900 rounded-2xl shadow-xl shadow-black/40 border border-slate-800 p-8 mb-6">
              <h2 className="text-2xl font-bold text-slate-50 mb-2">{currentQuestion.wording}</h2>
              {currentQuestion.description && (
                <p className="text-slate-300 mb-8">{currentQuestion.description}</p>
              )}

              <div className="mt-6">{renderQuestionInput(currentQuestion)}</div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 border-2 border-slate-700 rounded-xl font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>

            {currentQuestionIndex === totalQuestions - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Submit Entry
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
        </div>
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
