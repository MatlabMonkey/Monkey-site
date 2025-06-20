import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../../lib/supabaseClient"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, source } = body

    // Basic validation
    if (!content || content.trim() === "") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Optional: Add webhook authentication here
    // const authHeader = request.headers.get('authorization')
    // if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { data: todo, error } = await supabase
      .from("todos")
      .insert([
        {
          content: `${source ? `[${source}] ` : ""}${content.trim()}`,
          folder: "inbox",
          completed: false,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "Failed to create todo" }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        todo,
        message: "Todo added successfully via webhook",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
