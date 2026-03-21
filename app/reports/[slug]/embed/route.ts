import { NextRequest } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"
import { buildRenderableReportHtml } from "../../../../lib/server/reportRenderer"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data, error } = await supabase
    .from("work_reports")
    .select("title, html_content, asset_base_url, report_url")
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    return new Response(`Failed to load report: ${error.message}`, { status: 500 })
  }

  if (!data || !data.html_content) {
    return new Response("Report content not found", { status: 404 })
  }

  const html = buildRenderableReportHtml({
    title: data.title,
    htmlContent: data.html_content,
    assetBaseUrl: data.asset_base_url,
    fallbackReportUrl: data.report_url,
  })

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Keep content sandboxed + scriptless while permitting styles/assets.
      "Content-Security-Policy":
        "default-src 'none'; base-uri 'self' https:; script-src 'none'; object-src 'none'; frame-ancestors 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:; connect-src 'none'; media-src 'self' data: https:;",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
