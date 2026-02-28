import { NextResponse } from "next/server"
import { advanceRecurringRunDate } from "../../../../../lib/recurring"
import { createTodo, getSupabaseAdmin } from "../../../../../lib/server/todos"
import { type TodoContext } from "../../../../../lib/todos"

type RecurringTodoRecord = {
  id: string
  content: string
  context: TodoContext
  folder: string
  rrule: string
  next_run_at: string
  active: boolean
}

function todayDateString(): string {
  return new Date().toISOString().split("T")[0]
}

// Vercel crons send GET requests
export async function GET() {
  return runRecurringTodos()
}

export async function POST() {
  return runRecurringTodos()
}

async function runRecurringTodos() {
  try {
    const today = todayDateString()
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("recurring_todos")
      .select("*")
      .eq("active", true)
      .lte("next_run_at", today)
      .order("next_run_at", { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    const dueTodos = (data || []) as RecurringTodoRecord[]
    let createdCount = 0
    let failedCount = 0

    for (const recurringTodo of dueTodos) {
      try {
        await createTodo({
          content: recurringTodo.content,
          folder: "inbox",
          context: recurringTodo.context,
        })

        let nextRunAt = advanceRecurringRunDate(recurringTodo.rrule, recurringTodo.next_run_at)
        while (nextRunAt <= today) {
          nextRunAt = advanceRecurringRunDate(recurringTodo.rrule, nextRunAt)
        }

        const { error: updateError } = await supabase
          .from("recurring_todos")
          .update({
            next_run_at: nextRunAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recurringTodo.id)

        if (updateError) {
          throw new Error(updateError.message)
        }

        createdCount += 1
      } catch (errorForTodo) {
        failedCount += 1
        console.error(`Recurring run failed for ${recurringTodo.id}:`, errorForTodo)
      }
    }

    return NextResponse.json({
      createdCount,
      dueCount: dueTodos.length,
      failedCount,
    })
  } catch (error) {
    console.error("Recurring run POST error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
