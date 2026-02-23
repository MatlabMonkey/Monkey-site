"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Dumbbell, History, Sparkles } from "lucide-react"
import type { DayType, ExerciseMeta, GenerateWorkoutRequest, Workout, WorkoutApiResponse, WorkoutExercise } from "./types"

const DAY_TYPES: DayType[] = ["Push", "Pull", "Legs", "Upper", "Lower", "Full"]
const USER_ID = "demo-user"
const MIN_DURATION_MINUTES = 20
const MAX_DURATION_MINUTES = 180

function parseMeta(notes: string | null | undefined): ExerciseMeta {
  if (!notes || typeof notes !== "string") return {}
  try {
    const parsed = JSON.parse(notes) as unknown
    return parsed && typeof parsed === "object" ? (parsed as ExerciseMeta) : {}
  } catch {
    return {}
  }
}

async function readJsonSafe(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

function pickApiError(data: Record<string, unknown>, fallback: string) {
  const base = typeof data.error === "string" && data.error.trim() ? data.error : fallback
  const details = data.details
  if (!details) return base
  if (typeof details === "string") return `${base}\n${details}`
  try {
    return `${base}\n${JSON.stringify(details, null, 2)}`
  } catch {
    return base
  }
}

function completionPercent(exercises: WorkoutExercise[]) {
  if (!exercises.length) return 0
  const completed = exercises.filter((ex) => ex.status === "completed").length
  return Math.round((completed / exercises.length) * 100)
}

export default function WorkoutToolPage() {
  const [tab, setTab] = useState<"generator" | "history">("generator")
  const [dayType, setDayType] = useState<DayType>("Upper")
  const [durationMinutes, setDurationMinutes] = useState(45)
  const [notes, setNotes] = useState("")
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null)
  const [history, setHistory] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadWorkouts() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/workout?user_id=${USER_ID}`)
      const data = await readJsonSafe(res)
      if (!res.ok) throw new Error(pickApiError(data, "Failed to load workouts"))
      const typed = data as Partial<WorkoutApiResponse>
      setActiveWorkout(typed.activeWorkout ?? null)
      setHistory(Array.isArray(typed.history) ? typed.history : [])
    } catch (err) {
      console.error("[WorkoutToolPage] loadWorkouts failed", err)
      setError(err instanceof Error ? err.message : "Failed to load workouts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadWorkouts()
  }, [])

  const progress = useMemo(() => completionPercent(activeWorkout?.exercises || []), [activeWorkout])

  async function generateWorkout() {
    setGenerating(true)
    setError(null)

    try {
      if (activeWorkout) {
        const archiveRes = await fetch("/api/workout", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workout_id: activeWorkout.id, status: "archived" }),
        })
        if (!archiveRes.ok) {
          const archiveData = await readJsonSafe(archiveRes)
          throw new Error(pickApiError(archiveData, "Failed to archive previous workout"))
        }
      }

      const payload: GenerateWorkoutRequest & { user_id: string } = {
        user_id: USER_ID,
        day_type: dayType,
        duration_minutes: durationMinutes,
        notes: notes.trim() || undefined,
      }

      const res = await fetch("/api/workout/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await readJsonSafe(res)
      if (!res.ok) {
        console.error("[WorkoutToolPage] generateWorkout API error", {
          status: res.status,
          statusText: res.statusText,
          data,
          payload,
        })
        throw new Error(pickApiError(data, "Failed to generate workout"))
      }

      await loadWorkouts()
      setTab("generator")
    } catch (err) {
      console.error("[WorkoutToolPage] generateWorkout failed", err)
      setError(err instanceof Error ? err.message : "Failed to generate workout")
    } finally {
      setGenerating(false)
    }
  }

  async function toggleExercise(exercise: WorkoutExercise, checked: boolean) {
    if (!activeWorkout) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch("/api/workout", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workout_id: activeWorkout.id,
          exercises: [
            {
              id: exercise.id,
              status: checked ? "completed" : "pending",
              completed_sets: checked ? exercise.sets : 0,
            },
          ],
        }),
      })

      const data = await readJsonSafe(res)
      if (!res.ok) throw new Error(pickApiError(data, "Failed to update exercise"))

      setActiveWorkout((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          exercises: prev.exercises.map((ex) =>
            ex.id === exercise.id
              ? { ...ex, status: checked ? "completed" : "pending", completed_sets: checked ? ex.sets : 0 }
              : ex,
          ),
        }
      })
    } catch (err) {
      console.error("[WorkoutToolPage] toggleExercise failed", err)
      setError(err instanceof Error ? err.message : "Failed to update exercise")
    } finally {
      setSaving(false)
    }
  }

  async function markWorkoutComplete() {
    if (!activeWorkout) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch("/api/workout", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workout_id: activeWorkout.id, status: "completed" }),
      })
      const data = await readJsonSafe(res)
      if (!res.ok) throw new Error(pickApiError(data, "Failed to complete workout"))
      await loadWorkouts()
      setTab("history")
    } catch (err) {
      console.error("[WorkoutToolPage] markWorkoutComplete failed", err)
      setError(err instanceof Error ? err.message : "Failed to complete workout")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 text-[rgb(var(--text-muted))] transition-colors hover:text-[rgb(var(--text))]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tools
        </Link>

        <header className="mt-6 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Workout Generator</h1>
            <p className="mt-2 text-[rgb(var(--text-muted))]">Shoulder-safe, ITBS-aware sessions with live progress tracking.</p>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] px-4 py-2 text-sm text-[rgb(var(--text-muted))]">
            Active progress: <span className="font-semibold text-[rgb(var(--text))]">{progress}%</span>
          </div>
        </header>

        <div className="mb-6 inline-flex rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.55)] p-1">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === "generator"
                ? "bg-[rgb(var(--brand))] text-[rgb(var(--bg))]"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
            }`}
            onClick={() => setTab("generator")}
          >
            <span className="inline-flex items-center gap-2">
              <Dumbbell className="h-4 w-4" /> Generator
            </span>
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === "history"
                ? "bg-[rgb(var(--brand))] text-[rgb(var(--bg))]"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
            }`}
            onClick={() => setTab("history")}
          >
            <span className="inline-flex items-center gap-2">
              <History className="h-4 w-4" /> History
            </span>
          </button>
        </div>

        {error && (
          <div className="mb-6 whitespace-pre-wrap break-words rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {tab === "generator" && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.60)] p-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-[rgb(var(--text-muted))]">Day type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {DAY_TYPES.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setDayType(day)}
                        className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                          dayType === day
                            ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-weak)_/_0.7)] text-[rgb(var(--brand))]"
                            : "border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.5)] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="duration" className="mb-2 block text-sm text-[rgb(var(--text-muted))]">
                    Duration: {durationMinutes} min
                  </label>
                  <input
                    id="duration"
                    type="range"
                    min={MIN_DURATION_MINUTES}
                    max={MAX_DURATION_MINUTES}
                    step={5}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full accent-[rgb(var(--brand))]"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="notes" className="mb-2 block text-sm text-[rgb(var(--text-muted))]">
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Anything specific today? Equipment limits, pain flags, focus muscles..."
                  className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.45)] px-3 py-2 text-sm text-[rgb(var(--text))] outline-none ring-0 placeholder:text-[rgb(var(--text-muted))] focus:border-[rgb(var(--brand)_/_0.6)]"
                />
              </div>

              <button
                type="button"
                onClick={generateWorkout}
                disabled={generating}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[rgb(var(--brand))] px-5 py-2.5 text-sm font-semibold text-[rgb(var(--bg))] transition-colors hover:bg-[rgb(var(--brand-strong))] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className={`h-4 w-4 ${generating ? "animate-pulse" : ""}`} />
                {generating ? "Generating..." : "Generate Workout"}
              </button>
            </div>

            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.55)] p-5">
              {loading ? (
                <p className="text-[rgb(var(--text-muted))]">Loading active workout...</p>
              ) : !activeWorkout ? (
                <p className="text-[rgb(var(--text-muted))]">No active workout yet. Generate one above.</p>
              ) : (
                <div>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">
                        {activeWorkout.day_type} · {activeWorkout.duration_minutes} min
                      </h2>
                      <p className="text-sm text-[rgb(var(--text-muted))]">Generated {new Date(activeWorkout.generated_at).toLocaleString()}</p>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={markWorkoutComplete}
                      className="rounded-full border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.7)] px-4 py-2 text-sm font-medium text-[rgb(var(--brand))] transition-colors hover:bg-[rgb(var(--brand-weak)_/_0.9)] disabled:opacity-60"
                    >
                      Mark Workout Complete
                    </button>
                  </div>

                  <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-2))]">
                    <div className="h-full bg-[rgb(var(--brand))] transition-all" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="space-y-3">
                    {activeWorkout.exercises.map((exercise) => {
                      const meta = parseMeta(exercise.notes)
                      const timeLabel =
                        typeof meta.start_minute === "number" && typeof meta.end_minute === "number"
                          ? `${meta.start_minute}-${meta.end_minute}m`
                          : null

                      return (
                        <div
                          key={exercise.id}
                          className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.45)] px-4 py-3"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={exercise.status === "completed"}
                              onChange={(e) => void toggleExercise(exercise, e.target.checked)}
                              className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]"
                            />
                            <div className="w-full">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="font-medium">{exercise.name}</h3>
                                <div className="text-xs text-[rgb(var(--text-muted))]">
                                  {exercise.sets} x {exercise.reps} · rest {exercise.rest_seconds}s
                                </div>
                              </div>
                              <div className="mt-1 text-xs text-[rgb(var(--text-muted))]">
                                {[meta.block, timeLabel].filter(Boolean).join(" · ")}
                              </div>
                              {meta.cues && meta.cues.length > 0 && (
                                <p className="mt-2 text-xs text-[rgb(var(--text-muted))]">Cue: {meta.cues[0]}</p>
                              )}
                              {meta.substitutions && meta.substitutions.length > 0 && (
                                <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">Swap: {meta.substitutions[0]}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "history" && (
          <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.60)] p-5">
            {loading ? (
              <p className="text-[rgb(var(--text-muted))]">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="text-[rgb(var(--text-muted))]">No completed/archived workouts yet.</p>
            ) : (
              <div className="space-y-4">
                {history.map((workout) => {
                  const total = workout.exercises.length
                  const completed = workout.exercises.filter((ex) => ex.status === "completed").length
                  const percent = total ? Math.round((completed / total) * 100) : 0

                  return (
                    <article
                      key={workout.id}
                      className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2)_/_0.45)] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-medium">
                          {workout.day_type} · {workout.duration_minutes} min
                        </h3>
                        <span className="text-xs text-[rgb(var(--text-muted))]">{workout.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">
                        Generated {new Date(workout.generated_at).toLocaleString()}
                        {workout.completed_at ? ` · Completed ${new Date(workout.completed_at).toLocaleString()}` : ""}
                      </p>
                      <p className="mt-2 text-sm text-[rgb(var(--text-muted))]">
                        Completion: {completed}/{total} exercises ({percent}%)
                      </p>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
