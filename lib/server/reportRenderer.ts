export type ReportRenderInput = {
  title: string
  htmlContent: string
  assetBaseUrl?: string | null
  fallbackReportUrl?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function escapeAttribute(value: string): string {
  return escapeHtml(value)
}

function sanitizeHtml(source: string): string {
  let sanitized = source

  // Strip executable/scriptable embeds.
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
  sanitized = sanitized.replace(/<embed\b[^>]*>/gi, "")
  sanitized = sanitized.replace(/<link[^>]+rel=["']?import["']?[^>]*>/gi, "")

  // Remove inline handlers and javascript: URLs.
  sanitized = sanitized.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
  sanitized = sanitized.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
  sanitized = sanitized.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
  sanitized = sanitized.replace(/javascript\s*:/gi, "")

  return sanitized
}

function ensureHtmlDocument(bodyLikeHtml: string, title: string): string {
  if (/<html[\s>]/i.test(bodyLikeHtml)) return bodyLikeHtml

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body>
${bodyLikeHtml}
</body>
</html>`
}

function normalizeBaseHref(value: string): string {
  if (!value.endsWith("/")) return `${value}/`
  return value
}

function injectBaseHref(html: string, baseHref: string | null): string {
  if (!baseHref) return html

  const safeBase = normalizeBaseHref(baseHref)
  const baseTag = `<base href="${escapeAttribute(safeBase)}" />`

  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`)
  }

  return html.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`)
}

function inferAssetBaseUrl(fallbackReportUrl: string | null | undefined): string | null {
  if (!fallbackReportUrl || fallbackReportUrl.startsWith("/")) return null

  try {
    const url = new URL(fallbackReportUrl)
    const pathname = url.pathname
    url.pathname = pathname.endsWith("/") ? pathname : pathname.replace(/[^/]*$/, "")
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return null
  }
}

export function buildRenderableReportHtml(input: ReportRenderInput): string {
  const sanitized = sanitizeHtml(input.htmlContent)
  const document = ensureHtmlDocument(sanitized, input.title)
  const baseHref = input.assetBaseUrl || inferAssetBaseUrl(input.fallbackReportUrl)

  return injectBaseHref(document, baseHref)
}
