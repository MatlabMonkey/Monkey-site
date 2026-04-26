import Link from "next/link"
import { ArrowLeft, Calculator, CalendarClock, ChefHat, Dumbbell, Gauge, Home, Pill } from "lucide-react"

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2)_/_0.75)]"
          >
            <Home className="w-3.5 h-3.5" /> Home
          </Link>
        </div>

        <header className="mt-6 mb-8 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.55)] p-6">
          <h1 className="text-4xl font-bold">Tools</h1>
          <p className="text-[rgb(var(--text-muted))] mt-2">Utilities and calculators (quick daily workflows)</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/tools/medication-visualizer"
            className="group rounded-2xl border border-[rgb(var(--border))] bg-gradient-to-br from-[rgb(var(--surface)_/_0.7)] to-[rgb(var(--surface-2)_/_0.65)] p-5 hover:border-[rgb(var(--brand)_/_0.4)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.8)] p-2">
                <Pill className="w-5 h-5 text-[rgb(var(--brand))]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Medication Concentration Visualizer</h2>
                <p className="text-sm text-[rgb(var(--text-muted))]">Dose timing, concentration/effect, and sleep scoring</p>
              </div>
            </div>
          </Link>
          <Link
            href="/tools/bac"
            className="group rounded-2xl border border-[rgb(var(--border))] bg-gradient-to-br from-[rgb(var(--surface)_/_0.7)] to-[rgb(var(--surface-2)_/_0.65)] p-5 hover:border-[rgb(var(--brand)_/_0.4)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.8)] p-2">
                <Calculator className="w-5 h-5 text-[rgb(var(--brand))]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">BAC Calculator</h2>
                <p className="text-sm text-[rgb(var(--text-muted))]">Track your session and estimate BAC</p>
              </div>
            </div>
          </Link>
          <Link
            href="/tools/meal-prep"
            className="group rounded-2xl border border-[rgb(var(--border))] bg-gradient-to-br from-[rgb(var(--surface)_/_0.7)] to-[rgb(var(--surface-2)_/_0.65)] p-5 hover:border-[rgb(var(--brand)_/_0.4)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.8)] p-2">
                <ChefHat className="w-5 h-5 text-[rgb(var(--brand))]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Meal Prep</h2>
                <p className="text-sm text-[rgb(var(--text-muted))]">Weekly meal plan & shopping list</p>
              </div>
            </div>
          </Link>
          <Link
            href="/tools/workout"
            className="group rounded-2xl border border-[rgb(var(--border))] bg-gradient-to-br from-[rgb(var(--surface)_/_0.7)] to-[rgb(var(--surface-2)_/_0.65)] p-5 hover:border-[rgb(var(--brand)_/_0.4)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.8)] p-2">
                <Dumbbell className="w-5 h-5 text-[rgb(var(--brand))]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Workout Generator</h2>
                <p className="text-sm text-[rgb(var(--text-muted))]">Generate and track shoulder-safe sessions</p>
              </div>
            </div>
          </Link>
          <Link
            href="/tools/pd-controller"
            className="group rounded-2xl border border-[rgb(var(--border))] bg-gradient-to-br from-[rgb(var(--surface)_/_0.7)] to-[rgb(var(--surface-2)_/_0.65)] p-5 hover:border-[rgb(var(--brand)_/_0.4)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.8)] p-2">
                <Gauge className="w-5 h-5 text-[rgb(var(--brand))]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">PD Controller Visualizer</h2>
                <p className="text-sm text-[rgb(var(--text-muted))]">Tune Kp/Kd and inspect dynamics in real time</p>
              </div>
            </div>
          </Link>
          <Link
            href="/tools/focus-day"
            className="group rounded-2xl border border-[rgb(var(--border))] bg-gradient-to-br from-[rgb(var(--surface)_/_0.7)] to-[rgb(var(--surface-2)_/_0.65)] p-5 hover:border-[rgb(var(--brand)_/_0.4)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.8)] p-2">
                <CalendarClock className="w-5 h-5 text-[rgb(var(--brand))]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Focus Day Planner</h2>
                <p className="text-sm text-[rgb(var(--text-muted))]">Auto-build a realistic day block schedule</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}
