import { NextRequest } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"
import { buildRawStandaloneReportHtml } from "../../../../lib/server/reportRenderer"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data, error } = await supabase
    .from("work_reports")
    .select("title, report_type, html_content, asset_base_url, report_url")
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    return new Response(`Failed to load report: ${error.message}`, { status: 500 })
  }

  if (!data || data.report_type !== "html" || !data.html_content) {
    return new Response("Raw HTML report not found", { status: 404 })
  }

  const html = buildRawStandaloneReportHtml({
    title: data.title,
    htmlContent: data.html_content,
    assetBaseUrl: data.asset_base_url,
    fallbackReportUrl: data.report_url,
  })

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'self' data: blob: https:; base-uri 'self' https:; object-src 'none'; frame-ancestors 'self'; form-action 'self' https:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' data: https:; font-src 'self' data: https:; media-src 'self' data: blob: https:; connect-src 'self' https:; frame-src 'self' data: blob: https:; worker-src 'self' blob: https:; script-src 'self' 'unsafe-inline' https:;",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  })
}
