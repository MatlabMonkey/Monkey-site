import Link from "next/link"
import { ArrowLeft, Calculator } from "lucide-react"

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <header className="mt-6 mb-8">
          <h1 className="text-4xl font-bold">Tools</h1>
          <p className="text-slate-400 mt-2">Utilities and calculators</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/tools/bac"
            className="group rounded-2xl border border-slate-700/70 bg-slate-900/60 p-5 hover:bg-slate-800/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-indigo-700/40 bg-indigo-900/30 p-2">
                <Calculator className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">BAC Calculator</h2>
                <p className="text-sm text-slate-400">Track your session and estimate BAC</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}
