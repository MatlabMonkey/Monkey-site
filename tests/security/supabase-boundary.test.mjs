import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createServer } from "node:http"
import test from "node:test"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const script = "scripts/security/check-supabase.mjs"

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

function runBoundaryCheck(baseUrl) {
  return execFileAsync(process.execPath, [script], {
    env: {
      SECURITY_SUPABASE_PUBLISHABLE_KEY: "synthetic-publishable-key",
      SECURITY_SUPABASE_URL: baseUrl,
    },
  })
}

test("Supabase boundary accepts explicit denials without reading response bodies", async () => {
  await withServer((_request, response) => {
    response.statusCode = 403
    response.end()
  }, async (baseUrl) => {
    const result = await runBoundaryCheck(baseUrl)
    assert.match(result.stdout, /PASS anonymous SELECT exposes no journal_entry rows \(403; range missing\)/)
    assert.match(result.stdout, /PASS anonymous RPC denied for match_contact_embeddings \(403\)/)
    assert.match(result.stdout, /Supabase boundary result: PASS/)
  })
})

test("Supabase boundary accepts RLS-filtered HEAD responses with no visible rows", async () => {
  await withServer((request, response) => {
    if (request.method === "HEAD") {
      assert.equal(request.headers.range, "0-0")
      response.setHeader("Content-Range", "*/*")
      response.end()
      return
    }
    response.statusCode = 403
    response.end()
  }, async (baseUrl) => {
    const result = await runBoundaryCheck(baseUrl)
    assert.match(result.stdout, /PASS anonymous SELECT exposes no journal_entry rows \(200; range \*\/\*\)/)
    assert.match(result.stdout, /Supabase boundary result: PASS/)
  })
})

test("Supabase boundary rejects bodyless metadata showing an exposed row", async () => {
  let readBodyBytes = 0
  await withServer((request, response) => {
    if (request.method === "HEAD") {
      request.on("data", (chunk) => { readBodyBytes += chunk.length })
      response.setHeader("Content-Range", "0-0/*")
      response.end()
      return
    }
    response.statusCode = 403
    response.end()
  }, async (baseUrl) => {
    await assert.rejects(
      runBoundaryCheck(baseUrl),
      (error) => {
        assert.equal(error.code, 1)
        assert.match(error.stdout, /FAIL anonymous SELECT exposes no journal_entry rows \(200; range 0-0\/\*\)/)
        assert.match(error.stdout, /Supabase boundary result: FAIL/)
        return true
      },
    )
    assert.equal(readBodyBytes, 0)
  })
})

test("Supabase boundary rejects an anonymously callable private RPC without reading its response", async () => {
  let rpcRequestBody = ""
  await withServer((request, response) => {
    if (request.url === "/rest/v1/rpc/match_contact_embeddings") {
      request.setEncoding("utf8")
      request.on("data", (chunk) => { rpcRequestBody += chunk })
      request.on("end", () => {
        response.statusCode = 200
        response.end("synthetic private RPC response must not be read")
      })
      return
    }

    response.statusCode = 403
    response.end()
  }, async (baseUrl) => {
    await assert.rejects(
      runBoundaryCheck(baseUrl),
      (error) => {
        assert.equal(error.code, 1)
        assert.match(error.stdout, /FAIL anonymous RPC denied for match_contact_embeddings \(200\)/)
        assert.doesNotMatch(error.stdout, /synthetic private RPC response must not be read/)
        assert.match(error.stdout, /Supabase boundary result: FAIL/)
        return true
      },
    )

    const parsedBody = JSON.parse(rpcRequestBody)
    assert.equal(parsedBody.query_user_id, "security-regression-no-owner")
    assert.equal(parsedBody.query_embedding.length, 1536)
    assert.equal(parsedBody.query_embedding.every((value) => value === 0), true)
  })
})

test("Supabase boundary caps anonymous storage metadata and never logs it", async () => {
  let storageQuery
  const privateBucketName = "synthetic-private-bucket-name-must-not-be-logged"

  await withServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    if (url.pathname === "/storage/v1/bucket") {
      storageQuery = url.searchParams
      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify([{ id: privateBucketName, name: privateBucketName }]))
      return
    }

    response.statusCode = 403
    response.end()
  }, async (baseUrl) => {
    await assert.rejects(
      runBoundaryCheck(baseUrl),
      (error) => {
        assert.equal(error.code, 1)
        assert.match(error.stdout, /FAIL anonymous storage bucket metadata is denied or empty \(200\)/)
        assert.doesNotMatch(error.stdout, new RegExp(privateBucketName))
        assert.match(error.stdout, /Supabase boundary result: FAIL/)
        return true
      },
    )
  })

  assert.equal(storageQuery?.get("limit"), "1")
  assert.equal(storageQuery?.get("offset"), "0")
})
