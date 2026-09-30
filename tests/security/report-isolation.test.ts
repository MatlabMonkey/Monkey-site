import assert from "node:assert/strict"
import test from "node:test"

import { buildRawStandaloneReportHtml, buildRenderableReportHtml } from "../../lib/server/reportRenderer.ts"

const hostileFixture = `
  <base href="https://security-regression.invalid/">
  <meta http-equiv="refresh" content="0; url=https://security-regression.invalid/">
  <script>securityRegressionScript()</script>
  <img src="x" onerror="securityRegressionHandler()">
  <a href="javascript:securityRegressionUrl()">active URL</a>
  <form action="https://security-regression.invalid/"><input name="private"></form>
  <iframe src="https://security-regression.invalid/"></iframe>
  <object data="https://security-regression.invalid/"></object>
`

function assertInert(html: string) {
  const activePatterns = [
    ["script element", /<script\b/i],
    ["event handler", /\son[a-z]+\s*=/i],
    ["javascript URL", /javascript\s*:/i],
    ["form element", /<form\b/i],
    ["active embed", /<(?:iframe|object|embed)\b/i],
    ["hostile base URL", /<base\b[^>]+security-regression\.invalid/i],
    ["meta refresh", /http-equiv=["']refresh/i],
  ] as const

  for (const [label, pattern] of activePatterns) {
    assert.equal(pattern.test(html), false, `rendered report retained ${label}`)
  }
}

test("ordinary stored reports make hostile active content inert", () => {
  assertInert(buildRenderableReportHtml({ title: "Security fixture", htmlContent: hostileFixture }))
})

test("raw stored reports make hostile active content inert", () => {
  assertInert(buildRawStandaloneReportHtml({ title: "Security fixture", htmlContent: hostileFixture }))
})
