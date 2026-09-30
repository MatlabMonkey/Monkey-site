const targetValue = process.env.SECURITY_TARGET_URL
if (!targetValue) {
  console.error("SECURITY_TARGET_URL is required")
  process.exit(2)
}

const target = new URL(targetValue)
if (target.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(target.hostname)) {
  console.error("SECURITY_TARGET_URL must use HTTPS unless it is localhost")
  process.exit(2)
}

function endpoint(path) {
  return new URL(path, target).toString()
}

function stopIfDeploymentProtected(response) {
  const location = response.headers.get("location") ?? ""
  if (response.status === 302 && /^https:\/\/vercel\.com\/sso-api\?/i.test(location)) {
    console.error("BLOCKED target is behind Vercel deployment protection; provide an approved bypass or run from an authorized context")
    process.exit(2)
  }
}

async function probe(path, expectedStatuses, extraHeaders = {}) {
  const response = await fetch(endpoint(path), {
    redirect: "manual",
    headers: { "User-Agent": "Monkey-site-security-regression/1.0", ...extraHeaders },
  })
  stopIfDeploymentProtected(response)
  await response.body?.cancel()
  const passed = expectedStatuses.includes(response.status)
  console.log(`${passed ? "PASS" : "FAIL"} GET ${path} returned ${response.status}; expected ${expectedStatuses.join("/")}`)
  return passed
}

let passed = true
passed = (await probe("/api/journal/dashboard", [401])) && passed
passed = (await probe("/api/todos", [401])) && passed
passed = (await probe("/api/workout?user_id=security-regression-no-record", [401])) && passed
// A negative window moves the query start into the future, avoiding production-row access if auth regresses.
passed = (await probe("/api/usage?days=-3650", [401])) && passed
passed = (await probe("/api/test-env", [401, 404])) && passed
passed = (await probe("/reports/raw/security-regression-no-record", [307, 308, 401])) && passed
passed = (await probe("/api/journal/dashboard", [401], {
  "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware",
})) && passed
passed = (await probe("/journal/calendar", [307, 308, 401], {
  "Next-Router-Prefetch": "1",
  Purpose: "prefetch",
})) && passed
passed = (await probe("/journal/calendar.segment.rsc", [307, 308, 401], {
  RSC: "1",
  "Next-Router-Prefetch": "1",
})) && passed

const malformedSession = await fetch(endpoint("/api/journal/dashboard"), {
  redirect: "manual",
  headers: {
    Cookie: "pin_session=malformed-security-regression-token",
    "User-Agent": "Monkey-site-security-regression/1.0",
  },
})
await malformedSession.body?.cancel()
const malformedDenied = malformedSession.status === 401
console.log(`${malformedDenied ? "PASS" : "FAIL"} malformed session denied (${malformedSession.status})`)
passed = malformedDenied && passed

const crossOrigin = await fetch(endpoint("/api/journal/dashboard"), {
  redirect: "manual",
  headers: {
    Origin: "https://security-regression.invalid",
    "User-Agent": "Monkey-site-security-regression/1.0",
  },
})
await crossOrigin.body?.cancel()
const crossOriginDenied = crossOrigin.status === 401 && !crossOrigin.headers.get("access-control-allow-origin")
console.log(`${crossOriginDenied ? "PASS" : "FAIL"} credentialed cross-origin API access is not granted`)
passed = crossOriginDenied && passed

const root = await fetch(endpoint("/"), {
  redirect: "manual",
  headers: { "User-Agent": "Monkey-site-security-regression/1.0" },
})
await root.body?.cancel()
const requiredHeaders = [
  "content-security-policy",
  "permissions-policy",
  "referrer-policy",
  "x-content-type-options",
]
if (target.protocol === "https:") requiredHeaders.push("strict-transport-security")
for (const name of requiredHeaders) {
  const present = Boolean(root.headers.get(name))
  console.log(`${present ? "PASS" : "FAIL"} / header ${name}`)
  passed = present && passed
}

const authStatus = await fetch(endpoint("/api/auth/status"), {
  redirect: "manual",
  headers: { "User-Agent": "Monkey-site-security-regression/1.0" },
})
await authStatus.body?.cancel()
const cacheControl = authStatus.headers.get("cache-control") ?? ""
const privateCache = /no-store/i.test(cacheControl) && !/public/i.test(cacheControl)
console.log(`${privateCache ? "PASS" : "FAIL"} auth status cache policy is private/no-store`)
passed = privateCache && passed

if (process.env.SECURITY_PIN) {
  const login = await fetch(endpoint("/api/auth/pin"), {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Monkey-site-security-regression/1.0",
    },
    body: JSON.stringify({ pin: process.env.SECURITY_PIN }),
  })
  await login.body?.cancel()
  const setCookie = login.headers.get("set-cookie") ?? ""
  const cookie = setCookie.split(";", 1)[0]
  const cookieSafe =
    login.status === 200 &&
    cookie.startsWith("pin_session=") &&
    /;\s*HttpOnly/i.test(setCookie) &&
    /;\s*SameSite=Strict/i.test(setCookie) &&
    /;\s*Path=\//i.test(setCookie) &&
    (target.protocol !== "https:" || /;\s*Secure/i.test(setCookie))
  console.log(`${cookieSafe ? "PASS" : "FAIL"} valid login issues a hardened session cookie (${login.status})`)
  passed = cookieSafe && passed

  if (cookieSafe) {
    const authorizedStatus = await fetch(endpoint("/api/auth/status"), {
      redirect: "manual",
      headers: { Cookie: cookie, "User-Agent": "Monkey-site-security-regression/1.0" },
    })
    const statusBody = await authorizedStatus.json().catch(() => null)
    const validAccepted = authorizedStatus.status === 200 && statusBody?.authenticated === true
    console.log(`${validAccepted ? "PASS" : "FAIL"} valid session is accepted by auth status`)
    passed = validAccepted && passed

    const missingReport = await fetch(endpoint("/reports/raw/security-regression-no-record"), {
      redirect: "manual",
      headers: { Cookie: cookie, "User-Agent": "Monkey-site-security-regression/1.0" },
    })
    await missingReport.body?.cancel()
    const validReachesProtectedRoute = missingReport.status === 404
    console.log(`${validReachesProtectedRoute ? "PASS" : "FAIL"} valid session reaches protected synthetic report (${missingReport.status})`)
    passed = validReachesProtectedRoute && passed
  }
} else {
  console.log("SKIP valid-session smoke (SECURITY_PIN not set)")
}

console.log(`\nTarget smoke result: ${passed ? "PASS" : "FAIL"}`)
if (!passed) process.exitCode = 1
