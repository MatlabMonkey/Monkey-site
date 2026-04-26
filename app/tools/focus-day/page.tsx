"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarClock, Home } from "lucide-react"

function fmt(hour: number) {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  const d = new Date(Date.UTC(2020, 0, 1, h % 24, m))
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

export default function FocusDayPage() {
  const [wake, setWake] = useState(7.5)
  const [bed, setBed] = useState(23)
  const [deepHours, setDeepHours] = useState(3)
  const [workoutMins, setWorkoutMins] = useState(45)

  const blocks = useMemo(() => {
    const morningStart = wake + 0.5
    const deep1 = { label: "Deep work 1", start: morningStart, end: morningStart + deepHours * 0.6 }
    const admin = { label: "Admin / comms", start: deep1.end + 0.25, end: deep1.end + 1.25 }
    const workout = { label: "Workout", start: admin.end + 0.25, end: admin.end + 0.25 + workoutMins / 60 }
    const deep2Start = Math.max(workout.end + 0.5, 15)
    const deep2 = { label: "Deep work 2", start: deep2Start, end: deep2Start + deepHours * 0.4 }
    const shutdown = { label: "Shutdown + plan tomorrow", start: bed - 1.25, end: bed - 0.75 }
    return [deep1, admin, workout, deep2, shutdown]
  }, [wake, bed, deepHours, workoutMins])

  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2">
          <Link href="/tools" className="inline-flex items-center gap-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]">
            <ArrowLeft className="w-4 h-4" /> Back to Tools
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2)_/_0.75)]">
            <Home className="w-3.5 h-3.5" /> Home
          </Link>
        </div>

        <header className="mt-6 mb-6 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-6">
          <h1 className="text-3xl font-bold inline-flex items-center gap-2"><CalendarClock className="w-7 h-7" /> Focus Day Planner</h1>
          <p className="text-[rgb(var(--text-muted))] mt-2">A fast daily template that balances deep work, admin, training, and shutdown.</p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <label className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
            <p className="text-sm mb-2">Wake time: {fmt(wake)}</p>
            <input type="range" min={4} max={11} step={0.5} value={wake} onChange={(e) => setWake(Number(e.target.value))} className="w-full" />
          </label>
          <label className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
            <p className="text-sm mb-2">Bedtime: {fmt(bed)}</p>
            <input type="range" min={20} max={24} step={0.5} value={bed} onChange={(e) => setBed(Number(e.target.value))} className="w-full" />
          </label>
          <label className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
            <p className="text-sm mb-2">Deep work target: {deepHours.toFixed(1)} h</p>
            <input type="range" min={1} max={6} step={0.5} value={deepHours} onChange={(e) => setDeepHours(Number(e.target.value))} className="w-full" />
          </label>
          <label className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-4">
            <p className="text-sm mb-2">Workout time: {workoutMins} min</p>
            <input type="range" min={20} max={120} step={5} value={workoutMins} onChange={(e) => setWorkoutMins(Number(e.target.value))} className="w-full" />
          </label>
        </section>

        <section className="mt-6 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.60)] p-6">
          <h2 className="text-lg font-semibold mb-4">Suggested schedule</h2>
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li key={b.label} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] px-4 py-3 flex items-center justify-between">
                <span className="font-medium">{b.label}</span>
                <span className="text-sm text-[rgb(var(--text-muted))]">{fmt(b.start)} → {fmt(b.end)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
