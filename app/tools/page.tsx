import Link from "next/link"
import { ArrowLeft, Calculator, ChefHat } from "lucide-react"

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <header className="mt-6 mb-8">
          <h1 className="text-4xl font-bold">Tools</h1>
          <p className="text-[rgb(var(--text-muted))] mt-2">Utilities and calculators</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/tools/bac"
            className="group rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.60)] p-5 hover:bg-[rgb(var(--surface-2)_/_0.70)] transition-colors"
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
            className="group rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.60)] p-5 hover:bg-[rgb(var(--surface-2)_/_0.70)] transition-colors"
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
        </div>
      </div>
    </main>
  )
}
