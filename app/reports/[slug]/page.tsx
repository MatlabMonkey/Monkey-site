import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { supabase } from "../../../lib/supabaseClient"

export const dynamic = "force-dynamic"

type ReportRecord = {
  id: string
  slug: string | null
  title: string
  summary: string
  report_type: "html" | "md" | "pdf" | "link"
  report_url: string
  html_content: string | null
  content_md: string | null
  content_json: Record<string, unknown> | null
  asset_base_url: string | null
  project_key: string
  project_label: string
  published_by: string
  published_at: string
  tags: string[]
}

function isExternalUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://")
}

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data, error } = await supabase.from("work_reports").select("*").eq("slug", slug).maybeSingle()
  if (error) {
    throw new Error(`Failed to load report: ${error.message}`)
  }

  const report = data as ReportRecord | null
  if (!report) notFound()

  const hasRenderableHtml = report.report_type === "html" && Boolean(report.html_content)
  const hasRenderableMarkdown = report.report_type === "md" && Boolean(report.content_md)
  const hasRenderableJson = Boolean(report.content_json)

  const embedPath = `/reports/${slug}/embed`
  const rawHtmlPath = hasRenderableHtml ? `/reports/raw/${slug}` : null
  const sourceUrl = report.report_url
  const showSource = isExternalUrl(sourceUrl)

  const projectPath = report.project_key ? `/ops/projects/${encodeURIComponent(report.project_key)}` : "/ops"

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8 space-y-5">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link href={projectPath} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
              <ArrowLeft className="h-4 w-4" />
              Back to Project
            </Link>
            <Link href="/ops" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300">
              Ops index
            </Link>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{report.project_label}</p>
            <h1 className="mt-1 text-2xl md:text-4xl font-semibold">{report.title}</h1>
            <p className="mt-2 text-sm md:text-base text-slate-300">{report.summary}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1">{report.report_type}</span>
            <span>Published: {new Date(report.published_at).toLocaleString()}</span>
            <span>By: {report.published_by}</span>
            <span>Project key: {report.project_key}</span>
          </div>

          {report.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {(rawHtmlPath || showSource) && (
            <div className="flex flex-wrap items-center gap-4">
              {rawHtmlPath && (
                <Link href={rawHtmlPath} className="inline-flex items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200">
                  Open raw HTML view <ExternalLink className="h-4 w-4" />
                </Link>
              )}
              {showSource && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
                >
                  Open original source <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </header>

        {hasRenderableHtml ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-2 md:p-3">
            <iframe
              title={report.title}
              src={embedPath}
              sandbox="allow-same-origin"
              className="h-[75vh] w-full rounded-2xl border border-slate-800 bg-white"
            />
          </section>
        ) : hasRenderableMarkdown ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6">
            <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{report.content_md}</pre>
          </section>
        ) : hasRenderableJson ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6">
            <pre className="overflow-x-auto text-sm leading-6 text-slate-200">
              {JSON.stringify(report.content_json, null, 2)}
            </pre>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 text-sm text-slate-300">
            This report does not yet have on-site content stored in the database.
          </section>
        )}
      </div>
    </div>
  )
}
