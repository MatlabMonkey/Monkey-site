import { fetchWithTimeout } from "./fetch-with-timeout.mjs"

const baseUrl = process.env.SECURITY_SUPABASE_URL
const publishableKey = process.env.SECURITY_SUPABASE_PUBLISHABLE_KEY
if (!baseUrl || !publishableKey) {
  console.error("SECURITY_SUPABASE_URL and SECURITY_SUPABASE_PUBLISHABLE_KEY are required")
  process.exit(2)
}

const base = new URL(baseUrl)
if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) {
  console.error("SECURITY_SUPABASE_URL must use HTTPS unless it is localhost")
  process.exit(2)
}

const headers = {
  apikey: publishableKey,
  Authorization: `Bearer ${publishableKey}`,
  "Content-Type": "application/json",
  "User-Agent": "Monkey-site-security-regression/1.0",
}
const deniedStatuses = new Set([401, 403, 404])
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
const privateRpcs = [
  {
    name: "match_contact_embeddings",
    // A deterministic zero vector and impossible synthetic owner exercise the
    // function privilege without selecting a real owner or returning rows.
    body: {
      query_user_id: "security-regression-no-owner",
      query_embedding: Array(1536).fill(0),
      match_threshold: 1,
      match_count: 1,
    },
  },
]

let passed = true
for (const table of privateTables) {
  // HEAD plus a one-row range proves whether any row is visible without downloading
  // row contents or disclosing an exact production row count.
  const readResponse = await fetchWithTimeout(new URL(`/rest/v1/${table}?select=*&limit=1`, base), {
    method: "HEAD",
    headers: { ...headers, Range: "0-0" },
  })
  await readResponse.body?.cancel()
  const contentRange = readResponse.headers.get("content-range") ?? ""
  const noVisibleRows = /^\*\/(?:0|\*)$/.test(contentRange)
  const readSafe = deniedStatuses.has(readResponse.status) || (readResponse.ok && noVisibleRows)
  console.log(`${readSafe ? "PASS" : "FAIL"} anonymous SELECT exposes no ${table} rows (${readResponse.status}; range ${contentRange || "missing"})`)
  passed = readSafe && passed

  // Explicit null primary keys make this transaction-safe even if authorization regresses.
  const writeResponse = await fetchWithTimeout(new URL(`/rest/v1/${table}`, base), {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ id: null }),
  })
  await writeResponse.body?.cancel()
  const writeDenied = deniedStatuses.has(writeResponse.status)
  console.log(`${writeDenied ? "PASS" : "FAIL"} anonymous INSERT denied for ${table} (${writeResponse.status})`)
  passed = writeDenied && passed
}

for (const rpc of privateRpcs) {
  const response = await fetchWithTimeout(new URL(`/rest/v1/rpc/${rpc.name}`, base), {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(rpc.body),
  })
  await response.body?.cancel()
  const denied = deniedStatuses.has(response.status)
  console.log(`${denied ? "PASS" : "FAIL"} anonymous RPC denied for ${rpc.name} (${response.status})`)
  passed = denied && passed
}

// Limit the response to one metadata record. If anonymous bucket listing regresses,
// the gate proves exposure without downloading the complete bucket inventory.
const bucketUrl = new URL("/storage/v1/bucket", base)
bucketUrl.searchParams.set("limit", "1")
bucketUrl.searchParams.set("offset", "0")
const buckets = await fetchWithTimeout(bucketUrl, { headers })
let storageSafe = deniedStatuses.has(buckets.status)
if (buckets.ok) {
  const metadata = await buckets.json()
  storageSafe = Array.isArray(metadata) && metadata.length === 0
} else {
  await buckets.body?.cancel()
}
console.log(`${storageSafe ? "PASS" : "FAIL"} anonymous storage bucket metadata is denied or empty (${buckets.status})`)
passed = storageSafe && passed

console.log(`\nSupabase boundary result: ${passed ? "PASS" : "FAIL"}`)
if (!passed) process.exitCode = 1
