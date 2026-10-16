import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createServer } from "node:http"
import test from "node:test"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const script = "scripts/security/check-target.mjs"
const syntheticPin = "synthetic-preview-pin"
const syntheticBypass = "synthetic-deployment-protection-bypass"

async function withServer(handler, run) {
  const server = createServer(handler)
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })

  try {
    const address = server.address()
    assert.ok(address && typeof address !== "string")
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}

function runTargetCheck(targetUrl, extraEnv = {}) {
  return execFileAsync(process.execPath, [script], {
    env: {
      SECURITY_PIN: syntheticPin,
      SECURITY_TARGET_URL: targetUrl,
      ...extraEnv,
    },
  })
}

function hardenedTarget(request, response) {
  const url = new URL(request.url ?? "/", "http://127.0.0.1")
  const cookie = request.headers.cookie ?? ""

  response.setHeader("Cache-Control", "private, no-store")
  if (url.pathname === "/") {
    response.setHeader("Content-Security-Policy", "default-src 'self'")
    response.setHeader("Permissions-Policy", "camera=()")
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
    response.setHeader("X-Content-Type-Options", "nosniff")
    response.end("synthetic root")
    return
  }

  if (url.pathname === "/api/auth/pin" && request.method === "POST") {
    response.setHeader("Set-Cookie", "pin_session=synthetic-session; HttpOnly; SameSite=Strict; Path=/")
    response.end("ok")
    return
  }

  if (url.pathname === "/api/auth/status") {
    response.setHeader("Content-Type", "application/json")
    response.end(JSON.stringify({ authenticated: cookie === "pin_session=synthetic-session" }))
    return
  }

  if (url.pathname === "/reports/raw/security-regression-no-record") {
    response.statusCode = cookie === "pin_session=synthetic-session" ? 404 : 307
    response.end()
    return
  }

  if (url.pathname === "/journal/calendar" || url.pathname === "/journal/calendar.segment.rsc") {
    response.statusCode = 307
    response.end()
    return
  }

  if (url.pathname === "/api/test-env") {
    response.statusCode = 404
    response.end()
    return
  }

  response.statusCode = 401
  response.end()
}

test("target smoke accepts a synthetic deployment with hardened boundaries", async () => {
  await withServer(hardenedTarget, async (targetUrl) => {
    const result = await runTargetCheck(targetUrl)
    assert.match(result.stdout, /PASS valid session is accepted by auth status/)
    assert.match(result.stdout, /PASS valid session reaches protected synthetic report \(404\)/)
    assert.match(result.stdout, /Target smoke result: PASS/)
  })
})

test("target smoke uses an approved Vercel automation bypass without logging it", async () => {
  await withServer((request, response) => {
    if (request.headers["x-vercel-protection-bypass"] !== syntheticBypass) {
      response.statusCode = 302
      response.setHeader("Location", "https://vercel.com/sso-api?synthetic=1")
      response.end()
      return
    }

    hardenedTarget(request, response)
  }, async (targetUrl) => {
    const result = await runTargetCheck(targetUrl, {
      SECURITY_VERCEL_PROTECTION_BYPASS: syntheticBypass,
    })
    assert.match(result.stdout, /Target smoke result: PASS/)
    assert.doesNotMatch(result.stdout, new RegExp(syntheticBypass))
    assert.doesNotMatch(result.stderr, new RegExp(syntheticBypass))
  })
})

test("target smoke reports Vercel deployment protection as blocked", async () => {
  await withServer((_request, response) => {
    response.statusCode = 302
    response.setHeader("Location", "https://vercel.com/sso-api?synthetic=1")
    response.end()
  }, async (targetUrl) => {
    await assert.rejects(
      runTargetCheck(targetUrl),
      (error) => {
        assert.equal(error.code, 2)
        assert.match(error.stderr, /BLOCKED target is behind Vercel deployment protection/)
        return true
      },
    )
  })
})

test("target smoke fails closed when a network request stalls", async () => {
  await withServer(() => {
    // Deliberately leave the response open so the probe deadline must stop the check.
  }, async (targetUrl) => {
    await assert.rejects(
      runTargetCheck(targetUrl, { SECURITY_HTTP_TIMEOUT_MS: "50" }),
      (error) => {
        assert.equal(error.code, 1)
        assert.match(error.stderr, /security probe timed out after 50ms/)
        assert.doesNotMatch(error.stderr, /synthetic-preview-pin/)
        return true
      },
    )
  })
})
