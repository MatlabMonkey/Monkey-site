export type ReportRenderInput = {
  title: string
  htmlContent: string
  assetBaseUrl?: string | null
  fallbackReportUrl?: string | null
}

type ReportRenderOptions = {
  sanitize?: boolean
  ensureViewport?: boolean
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

function hasHeadTag(html: string): boolean {
  return /<head[\s>]/i.test(html)
}

function injectIntoHead(html: string, snippet: string): string {
  if (hasHeadTag(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${snippet}`)
  }

  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${snippet}</head>`)
  }

  return html
}

function ensureViewportMeta(html: string): string {
  if (/<meta[^>]+name=["']viewport["'][^>]*>/i.test(html)) return html

  return injectIntoHead(html, '<meta name="viewport" content="width=device-width, initial-scale=1" />')
}

function injectBaseHref(html: string, baseHref: string | null): string {
  if (!baseHref) return html

  const safeBase = normalizeBaseHref(baseHref)
  const baseTag = `<base href="${escapeAttribute(safeBase)}" />`

  if (/<base[\s>]/i.test(html)) {
    return html.replace(/<base\b[^>]*>/i, baseTag)
  }

  return injectIntoHead(html, baseTag)
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

function buildReportHtml(input: ReportRenderInput, options: ReportRenderOptions): string {
  const shouldSanitize = options.sanitize ?? true
  const shouldEnsureViewport = options.ensureViewport ?? true

  const htmlContent = shouldSanitize ? sanitizeHtml(input.htmlContent) : input.htmlContent
  let document = ensureHtmlDocument(htmlContent, input.title)

  if (shouldEnsureViewport) {
    document = ensureViewportMeta(document)
  }

  const baseHref = input.assetBaseUrl || inferAssetBaseUrl(input.fallbackReportUrl)
  return injectBaseHref(document, baseHref)
}

export function buildRenderableReportHtml(input: ReportRenderInput): string {
  return buildReportHtml(input, {
    sanitize: true,
    ensureViewport: true,
  })
}

export function buildRawStandaloneReportHtml(input: ReportRenderInput): string {
  return buildReportHtml(input, {
    sanitize: false,
    ensureViewport: true,
  })
}
