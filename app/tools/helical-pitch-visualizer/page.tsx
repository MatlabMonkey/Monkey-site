import Link from "next/link"
import { ArrowLeft, ExternalLink, Home } from "lucide-react"

const visualizerPath = "/visualizers/helical-pitch/index.html"

export default function HelicalPitchVisualizerPage() {
  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <div className="flex h-screen flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface)_/_0.86)] px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 text-sm text-[rgb(var(--text-muted))] transition-colors hover:text-[rgb(var(--text))]"
            >
              <ArrowLeft className="h-4 w-4" />
              Tools
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] px-3 py-1.5 text-xs text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2)_/_0.75)]"
            >
              <Home className="h-3.5 w-3.5" />
              Home
            </Link>
          </div>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-sm font-semibold sm:text-base">Helical Pitch Visualizer</h1>
            <p className="text-xs text-[rgb(var(--text-muted))]">Static browser app; microphone access requires HTTPS outside localhost.</p>
          </div>
          <a
            href={visualizerPath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-3 py-1.5 text-sm text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-2)_/_0.75)] hover:text-[rgb(var(--text))]"
          >
            <ExternalLink className="h-4 w-4" />
            Open
          </a>
        </div>
        <iframe
          title="Helical Pitch Visualizer"
          src={visualizerPath}
          allow="microphone; autoplay"
          className="min-h-0 flex-1 border-0"
        />
      </div>
    </main>
  )
}
