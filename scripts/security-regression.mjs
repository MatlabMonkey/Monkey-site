import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"

const releaseMode = process.argv.includes("--release")
const testFiles = readdirSync("tests", { recursive: true })
  .filter((file) => /\.test\.(?:ts|js|mjs)$/.test(file))
  .map((file) => `tests/${file}`)

const commands = [
  ["static security boundaries", process.execPath, ["scripts/security/check-static.mjs"]],
  ["application and security fixtures", process.execPath, ["--test", ...testFiles]],
  ["production dependency audit", "npm", ["audit", "--omit=dev", "--audit-level=high"]],
  ["full dependency audit", "npm", ["audit", "--audit-level=high"]],
  ["lint", "npm", ["run", "lint"]],
  ["production build", "npm", ["run", "build"]],
]

const hasTarget = Boolean(process.env.SECURITY_TARGET_URL)
const hasSupabase = Boolean(process.env.SECURITY_SUPABASE_URL && process.env.SECURITY_SUPABASE_PUBLISHABLE_KEY)
const hasPin = Boolean(process.env.SECURITY_PIN)
if (hasTarget) commands.push(["unauthenticated target smoke", process.execPath, ["scripts/security/check-target.mjs"]])
if (hasSupabase) commands.push(["anonymous Supabase boundary", process.execPath, ["scripts/security/check-supabase.mjs"]])

const results = []
for (const [name, executable, args] of commands) {
  console.log(`\n=== ${name} ===`)
  const commandEnv = name === "production build"
    ? {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "security-regression-build-placeholder",
      }
    : process.env
  const result = spawnSync(executable, args, { stdio: "inherit", env: commandEnv })
  results.push({ name, passed: result.status === 0, status: result.status ?? "signal" })
}

if (releaseMode && !hasTarget) results.push({ name: "unauthenticated target smoke", passed: false, status: "missing SECURITY_TARGET_URL" })
if (releaseMode && !hasPin) results.push({ name: "valid-session target smoke", passed: false, status: "missing SECURITY_PIN" })
if (releaseMode && !hasSupabase) {
  results.push({
    name: "anonymous Supabase boundary",
    passed: false,
    status: "missing SECURITY_SUPABASE_URL/SECURITY_SUPABASE_PUBLISHABLE_KEY",
  })
}

console.log("\n=== security gate summary ===")
for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} ${result.name}${result.passed ? "" : ` (${result.status})`}`)
}
const failures = results.filter((result) => !result.passed)
console.log(`Security gate result: ${failures.length ? "FAIL" : "PASS"} (${results.length - failures.length}/${results.length})`)
if (failures.length) process.exitCode = 1
