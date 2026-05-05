import Link from "next/link"
import { ArrowLeft, ExternalLink, FileText, Home } from "lucide-react"

type WorkSample = {
  title: string
  href: string
  note?: string
}

const WORK_SAMPLES: WorkSample[] = [
  // Add your PDFs here. Example:
  // { title: "Flight Controls Report", href: "/work/flight-controls-report.pdf", note: "PDF" },
]

export default function WorkSamplesPage() {
  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2">
          <Link href="/" className="inline-flex items-center gap-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2)_/_0.75)]">
            <Home className="w-3.5 h-3.5" /> Home
          </Link>
        </div>

        <header className="mt-6 mb-8 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-6">
          <h1 className="text-3xl font-bold">Examples of Work</h1>
          <p className="text-[rgb(var(--text-muted))] mt-2">Simple links to PDFs or public docs.</p>
        </header>

        {WORK_SAMPLES.length === 0 ? (
          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.6)] p-5 text-[rgb(var(--text-muted))]">
            <p className="font-medium text-[rgb(var(--text))]">No examples added yet.</p>
            <p className="mt-2 text-sm">
              Upload files to <code className="px-1.5 py-0.5 rounded bg-[rgb(var(--surface-2))]">public/work</code> and add links in
              <code className="px-1.5 py-0.5 rounded bg-[rgb(var(--surface-2))] ml-1">app/work/page.tsx</code>.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {WORK_SAMPLES.map((sample) => (
              <a
                key={sample.href}
                href={sample.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.65)] p-5 hover:border-[rgb(var(--brand)_/_0.4)] transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.8)] p-2">
                      <FileText className="w-5 h-5 text-[rgb(var(--brand))]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{sample.title}</h2>
                      {sample.note && <p className="text-sm text-[rgb(var(--text-muted))]">{sample.note}</p>}
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[rgb(var(--text-muted))] group-hover:text-[rgb(var(--text))]" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
