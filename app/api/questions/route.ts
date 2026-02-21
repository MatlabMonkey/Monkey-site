import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "../../../lib/supabaseClient"

export async function GET() {
  try {
    const { data: questions, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        { error: "Failed to fetch questions", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ questions: questions || [] })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const content = typeof body.content === "string" ? body.content.trim() : ""
    const authorLabelRaw = typeof body.author_label === "string" ? body.author_label.trim() : ""

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const author_label = authorLabelRaw || "Anonymous"

    const { data: question, error } = await supabase
      .from("questions")
      .insert([{ content, author_label }])
      .select()
      .single()

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        { error: "Failed to create question", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ question }, { status: 201 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
