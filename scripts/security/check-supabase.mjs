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

let passed = true
for (const table of privateTables) {
  const readResponse = await fetch(new URL(`/rest/v1/${table}?select=*&limit=0`, base), {
    headers: { ...headers, Prefer: "count=exact" },
  })
  await readResponse.body?.cancel()
  const readDenied = deniedStatuses.has(readResponse.status)
  console.log(`${readDenied ? "PASS" : "FAIL"} anonymous SELECT denied for ${table} (${readResponse.status})`)
  passed = readDenied && passed

  // Explicit null primary keys make this transaction-safe even if authorization regresses.
  const writeResponse = await fetch(new URL(`/rest/v1/${table}`, base), {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ id: null }),
  })
  await writeResponse.body?.cancel()
  const writeDenied = deniedStatuses.has(writeResponse.status)
  console.log(`${writeDenied ? "PASS" : "FAIL"} anonymous INSERT denied for ${table} (${writeResponse.status})`)
  passed = writeDenied && passed
}

const buckets = await fetch(new URL("/storage/v1/bucket", base), { headers })
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
