import { type NextRequest, NextResponse } from "next/server"
import { TodoValidationError, updateTodoById } from "../../../../lib/server/todos"

type ReorderItem = {
  id: string
  sort_order: number
}

function parseReorderItems(body: unknown): ReorderItem[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { items?: unknown }).items)) {
    throw new TodoValidationError("items must be an array")
  }

  const rawItems = (body as { items: unknown[] }).items

  return rawItems.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new TodoValidationError(`items[${index}] must be an object`)
    }

    const id = (entry as { id?: unknown }).id
    const sortOrder = (entry as { sort_order?: unknown }).sort_order

    if (typeof id !== "string" || !id.trim()) {
      throw new TodoValidationError(`items[${index}].id must be a non-empty string`)
    }

    if (typeof sortOrder !== "number" || !Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new TodoValidationError(`items[${index}].sort_order must be a non-negative integer`)
    }

    return { id: id.trim(), sort_order: sortOrder }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown
    const items = parseReorderItems(body)

    await Promise.all(items.map((item) => updateTodoById(item.id, { sort_order: item.sort_order })))

    return NextResponse.json({ success: true, updated: items.length })
  } catch (error) {
    if (error instanceof TodoValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
