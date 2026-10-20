import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

const baseUrl = process.env.TODO_CAPTURE_BASE_URL?.replace(/\/$/, "")
const token = process.env.TODO_CAPTURE_TOKEN

if (!baseUrl || !token) {
  console.error("Set TODO_CAPTURE_BASE_URL and TODO_CAPTURE_TOKEN for a disposable or preview environment.")
  process.exit(2)
}

const captureId = randomUUID()
const title = process.argv.slice(2).join(" ").trim() || `Shortcut verification ${captureId}`

async function capture(captureTitle) {
  const response = await fetch(`${baseUrl}/api/tasks/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: captureTitle, capture_id: captureId }),
  })
  return { response, body: await response.json() }
}

const created = await capture(title)
assert.equal(created.response.status, 201)
assert.equal(created.body.replayed, false)
assert.equal(created.body.task.title, title)
assert.equal(created.body.task.status, "inbox")

const replayed = await capture(title)
assert.equal(replayed.response.status, 200)
assert.equal(replayed.body.replayed, true)
assert.equal(replayed.body.task.id, created.body.task.id)

const conflict = await capture(`${title} changed`)
assert.equal(conflict.response.status, 409)

console.log(`Shortcut capture verified for task ${created.body.task.id}; create, replay, and conflict behavior passed.`)
