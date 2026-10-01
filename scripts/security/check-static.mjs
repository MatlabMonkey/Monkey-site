import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const checks = []

function record(name, passed, detail) {
  checks.push({ name, passed, detail })
}

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
}

function read(path) {
  return readFileSync(path, "utf8")
}

function routePath(file) {
  return file.replace(/^app/, "").replace(/\/route\.ts$/, "") || "/"
}

function middlewareCovers(path, matchers) {
  return matchers.some((matcher) => {
    if (matcher.endsWith("/:path*")) {
      const prefix = matcher.slice(0, -7)
      return path === prefix || path.startsWith(`${prefix}/`)
    }
    return path === matcher
  })
}

const files = trackedFiles()
const middleware = read("middleware.ts")
const matchers = [...middleware.matchAll(/["'](\/[^"']+)["']/g)]
  .map((match) => match[1])
  .filter((value) => value.includes(":path*") || value.startsWith("/api/"))

const publicApiRoutes = new Set([
  "/api/auth/logout",
  "/api/auth/pin",
  "/api/auth/status",
  "/api/capture",
  "/api/webhook/todos",
])
const apiRouteFiles = files.filter((file) => /^app\/api\/.+\/route\.ts$/.test(file))
const privateApiFiles = apiRouteFiles.filter((file) => !publicApiRoutes.has(routePath(file)))
const uncoveredApiRoutes = privateApiFiles
  .map(routePath)
  .filter((path) => !middlewareCovers(path, matchers))

record(
  "HTTP route inventory is fail-closed",
  uncoveredApiRoutes.length === 0,
  uncoveredApiRoutes.length ? `unprotected: ${uncoveredApiRoutes.join(", ")}` : `${privateApiFiles.length} private API routes covered`,
)

const handlerGuardPattern = /\b(?:isRequestAuthenticated|requirePinSession|require[A-Za-z]*Auth|assert[A-Za-z]*Auth)\b/
const unguardedHandlers = privateApiFiles.filter((file) => !handlerGuardPattern.test(read(file)))
record(
  "private API handlers have defense-in-depth authorization",
  unguardedHandlers.length === 0,
  unguardedHandlers.length ? `${unguardedHandlers.length} handlers lack a recognized server guard` : "all private handlers have a server guard",
)

const privatePageRoutes = ["/reports/[slug]", "/reports/[slug]/embed", "/reports/raw/[slug]"]
const uncoveredReportRoutes = privatePageRoutes.filter((path) => !middlewareCovers(path, matchers))
record(
  "stored report routes require authentication",
  uncoveredReportRoutes.length === 0,
  uncoveredReportRoutes.length ? `unprotected: ${uncoveredReportRoutes.join(", ")}` : "page, embed, and raw routes covered",
)

const migrationFiles = files.filter((file) => /^supabase\/migrations\/\d+_.+\.sql$/.test(file)).sort()
const versions = new Map()
for (const file of migrationFiles) {
  const version = file.match(/\/(\d+)_/)?.[1]
  if (!version) continue
  versions.set(version, [...(versions.get(version) ?? []), file])
}
const duplicateVersions = [...versions.entries()].filter(([, names]) => names.length > 1)
record(
  "Supabase migration versions are unique",
  duplicateVersions.length === 0,
  duplicateVersions.length
    ? `duplicates: ${duplicateVersions.map(([version]) => version).join(", ")}`
    : `${migrationFiles.length} unique migrations`,
)

const migrationSql = migrationFiles.map((file) => read(file)).join("\n")
const privateTables = [
  "journal_entry",
  "journal_answer",
  "todos",
  "recurring_todos",
  "work_focus",
  "work_updates",
  "work_tasks",
  "ops_projects",
  "work_reports",
  "ideas",
  "meal_prep_weekly",
  "usage_daily",
]
const tablesWithoutAnonRevoke = privateTables.filter((table) => {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const revoke = new RegExp(
    `REVOKE\\s+ALL(?:\\s+PRIVILEGES)?\\s+ON(?:\\s+TABLE)?\\s+(?:public\\.)?${escaped}\\s+FROM\\s+[^;]*(?:anon|PUBLIC)`,
    "i",
  )
  return !revoke.test(migrationSql)
})
record(
  "private Supabase tables revoke direct anonymous grants",
  tablesWithoutAnonRevoke.length === 0,
  tablesWithoutAnonRevoke.length ? `missing revocation: ${tablesWithoutAnonRevoke.join(", ")}` : `${privateTables.length} private tables locked down`,
)

const reportRenderer = read("lib/server/reportRenderer.ts")
const rawRoute = read("app/reports/raw/[slug]/route.ts")
record(
  "raw reports cannot bypass sanitization",
  !/sanitize:\s*false/.test(reportRenderer),
  /sanitize:\s*false/.test(reportRenderer) ? "raw renderer explicitly disables sanitization" : "no sanitizer bypass found",
)
record(
  "raw report policy blocks script and network execution",
  /script-src\s+'none'/.test(rawRoute) && /connect-src\s+'none'/.test(rawRoute),
  "requires script-src 'none' and connect-src 'none'",
)

const nextConfig = read("next.config.ts")
const requiredHeaders = [
  "Content-Security-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
]
const missingHeaders = requiredHeaders.filter((header) => !nextConfig.includes(header))
record(
  "global browser security headers are configured",
  missingHeaders.length === 0,
  missingHeaders.length ? `missing: ${missingHeaders.join(", ")}` : `${requiredHeaders.length} baseline headers configured`,
)

const pinRoute = read("app/api/auth/pin/route.ts")
record(
  "PIN lockout is not process-local",
  !/new\s+Map\s*</.test(pinRoute),
  /new\s+Map\s*</.test(pinRoute) ? "module-level Map lockout found" : "no process-local Map lockout found",
)

const contactSources = files
  .filter((file) => /^app\/workspace\/contacts\/.+\.(?:ts|tsx)$/.test(file))
  .map((file) => read(file))
  .join("\n")
record(
  "contact drafts avoid URLs and persistent browser storage",
  !/localStorage|searchParams\.set\(["']draft|[?&]draft=/.test(contactSources),
  "contact draft flow must not use draft query parameters or localStorage",
)

const browserPublicKeyUsers = files.filter((file) =>
  /^(?:app\/(?!api\/)|lib\/).+\.(?:ts|tsx|js|mjs)$/.test(file) && read(file).includes("NEXT_PUBLIC_API_KEY"),
)
record(
  "custom authorization keys are not browser-public",
  browserPublicKeyUsers.length === 0,
  browserPublicKeyUsers.length ? `browser-public key references: ${browserPublicKeyUsers.join(", ")}` : "no custom NEXT_PUBLIC_API_KEY references",
)

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
]
const secretFiles = []
for (const file of files) {
  let source
  try {
    source = read(file)
  } catch {
    continue
  }
  if (secretPatterns.some((pattern) => {
    pattern.lastIndex = 0
    return pattern.test(source)
  })) {
    secretFiles.push(file)
  }
}
record(
  "tracked files contain no private credential patterns",
  secretFiles.length === 0,
  secretFiles.length ? `credential-shaped values in ${secretFiles.length} tracked file(s): ${secretFiles.join(", ")}` : "no private credential patterns found",
)

assert.ok(checks.length >= 10, "security scanner unexpectedly lost coverage")
for (const check of checks) {
  console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name} — ${check.detail}`)
}

const failures = checks.filter((check) => !check.passed)
console.log(`\nStatic security boundary result: ${checks.length - failures.length}/${checks.length} passed`)
if (failures.length) process.exitCode = 1
