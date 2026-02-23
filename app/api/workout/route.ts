import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

type ExerciseUpdate = {
  id: string
  status?: "pending" | "completed" | "skipped"
  completed_sets?: number
  notes?: string
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("user_id") || request.headers.get("x-user-id") || "demo-user"

    const { data: workouts, error: workoutsError } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(50)

    if (workoutsError) {
      return NextResponse.json({ error: workoutsError.message }, { status: 500 })
    }

    if (!workouts?.length) {
      return NextResponse.json({ activeWorkout: null, history: [] })
    }

    const workoutIds = workouts.map((w) => w.id)
    const { data: exercises, error: exerciseError } = await supabase
      .from("workout_exercises")
      .select("*")
      .in("workout_id", workoutIds)
      .order("order_index", { ascending: true })

    if (exerciseError) {
      return NextResponse.json({ error: exerciseError.message }, { status: 500 })
    }

    const exerciseByWorkout = (exercises || []).reduce<Record<string, any[]>>((acc, ex) => {
      if (!acc[ex.workout_id]) acc[ex.workout_id] = []
      acc[ex.workout_id].push(ex)
      return acc
    }, {})

    const hydrated = workouts.map((w) => ({
      ...w,
      exercises: exerciseByWorkout[w.id] || [],
    }))

    const activeWorkout = hydrated.find((w) => w.status === "active") || null
    const history = hydrated.filter((w) => w.status !== "active")

    return NextResponse.json({ activeWorkout, history })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      workout_id: string
      status?: "active" | "completed" | "archived"
      exercises?: ExerciseUpdate[]
    }

    if (!body.workout_id) {
      return NextResponse.json({ error: "workout_id is required" }, { status: 400 })
    }

    if (Array.isArray(body.exercises) && body.exercises.length > 0) {
      for (const ex of body.exercises) {
        const patch: Record<string, unknown> = {}
        if (ex.status) patch.status = ex.status
        if (typeof ex.completed_sets === "number") patch.completed_sets = ex.completed_sets
        if (typeof ex.notes === "string") patch.notes = ex.notes
        if (Object.keys(patch).length > 0) {
          const { error } = await supabase.from("workout_exercises").update(patch).eq("id", ex.id)
          if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
          }
        }
      }
    }

    if (body.status) {
      const workoutPatch: Record<string, unknown> = { status: body.status }
      if (body.status === "completed") {
        workoutPatch.completed_at = new Date().toISOString()
      }

      const { error } = await supabase.from("workouts").update(workoutPatch).eq("id", body.workout_id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    const { data: workout, error: workoutError } = await supabase
      .from("workouts")
      .select("*")
      .eq("id", body.workout_id)
      .single()

    if (workoutError) {
      return NextResponse.json({ error: workoutError.message }, { status: 500 })
    }

    const { data: exercises, error: exercisesError } = await supabase
      .from("workout_exercises")
      .select("*")
      .eq("workout_id", body.workout_id)
      .order("order_index", { ascending: true })

    if (exercisesError) {
      return NextResponse.json({ error: exercisesError.message }, { status: 500 })
    }

    return NextResponse.json({ workout, exercises: exercises || [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    )
  }
}
