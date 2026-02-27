import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

type ExerciseUpdate = {
  id: string
  status?: "pending" | "completed" | "skipped"
  completed_sets?: number
  notes?: string
  weight_lbs?: number | null
}

type WorkoutPatchRequest = {
  workout_id?: string
  status?: "active" | "completed" | "archived"
  exercises?: ExerciseUpdate[]
}

const WORKOUT_STATUS = new Set(["active", "completed", "archived"] as const)
const EXERCISE_STATUS = new Set(["pending", "completed", "skipped"] as const)
const USER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase credentials are not configured")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function normalizeUserId(request: NextRequest): string | null {
  const fromQuery = request.nextUrl.searchParams.get("user_id")?.trim()
  const fromHeader = request.headers.get("x-user-id")?.trim()
  const userId = fromQuery || fromHeader || "demo-user"
  return USER_ID_PATTERN.test(userId) ? userId : null
}

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

export async function GET(request: NextRequest) {
  try {
    const userId = normalizeUserId(request)
    if (!userId) {
      return NextResponse.json({ error: "user_id contains invalid characters" }, { status: 400 })
    }
    const supabase = getSupabaseAdminClient()

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

    const exerciseByWorkout = (exercises || []).reduce<Record<string, Record<string, unknown>[]>>((acc, ex) => {
      if (!acc[ex.workout_id]) acc[ex.workout_id] = []
      acc[ex.workout_id].push(ex as Record<string, unknown>)
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
    const body = (await request.json()) as WorkoutPatchRequest
    const supabase = getSupabaseAdminClient()

    const workoutId = typeof body.workout_id === "string" ? body.workout_id.trim() : ""
    if (!workoutId) {
      return NextResponse.json({ error: "workout_id is required" }, { status: 400 })
    }

    if (body.status !== undefined && !WORKOUT_STATUS.has(body.status)) {
      return NextResponse.json({ error: "status must be one of active, completed, archived" }, { status: 400 })
    }

    if (body.exercises !== undefined && !Array.isArray(body.exercises)) {
      return NextResponse.json({ error: "exercises must be an array when provided" }, { status: 400 })
    }

    const completedWeightUpdates: Array<{ exercise_name: string; weight_lbs: number }> = []

    if (Array.isArray(body.exercises) && body.exercises.length > 0) {
      for (const ex of body.exercises) {
        if (!ex || typeof ex !== "object") {
          return NextResponse.json({ error: "exercise updates must be objects" }, { status: 400 })
        }
        if (typeof ex.id !== "string" || !ex.id.trim()) {
          return NextResponse.json({ error: "exercise id is required for each update" }, { status: 400 })
        }
        if (ex.status !== undefined && !EXERCISE_STATUS.has(ex.status)) {
          return NextResponse.json({ error: "exercise status must be pending, completed, or skipped" }, { status: 400 })
        }

        const patch: Record<string, unknown> = {}
        if (ex.status) patch.status = ex.status
        if (ex.completed_sets !== undefined) {
          if (!Number.isInteger(ex.completed_sets) || ex.completed_sets < 0 || ex.completed_sets > 50) {
            return NextResponse.json({ error: "completed_sets must be an integer between 0 and 50" }, { status: 400 })
          }
          patch.completed_sets = ex.completed_sets
        }
        if (typeof ex.notes === "string") patch.notes = ex.notes
        if (ex.notes !== undefined && typeof ex.notes !== "string") {
          return NextResponse.json({ error: "notes must be a string when provided" }, { status: 400 })
        }
        if (ex.weight_lbs !== undefined) {
          if (
            ex.weight_lbs !== null &&
            (typeof ex.weight_lbs !== "number" || !Number.isFinite(ex.weight_lbs) || ex.weight_lbs <= 0 || ex.weight_lbs > 2000)
          ) {
            return NextResponse.json({ error: "weight_lbs must be a number between 0 and 2000, or null" }, { status: 400 })
          }
          patch.weight_lbs = ex.weight_lbs === null ? null : Number.parseFloat(ex.weight_lbs.toFixed(2))
        }

        if (Object.keys(patch).length > 0) {
          const { data, error } = await supabase
            .from("workout_exercises")
            .update(patch)
            .eq("id", ex.id)
            .eq("workout_id", workoutId)
            .select("id, name, status, weight_lbs")

          if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
          }
          if (!data?.length) {
            return NextResponse.json({ error: `exercise ${ex.id} was not found in workout ${workoutId}` }, { status: 404 })
          }

          const updatedExercise = data[0] as {
            name: string
            status: "pending" | "completed" | "skipped"
            weight_lbs: number | null
          }

          if (
            updatedExercise.status === "completed" &&
            typeof updatedExercise.weight_lbs === "number" &&
            Number.isFinite(updatedExercise.weight_lbs) &&
            updatedExercise.weight_lbs > 0
          ) {
            completedWeightUpdates.push({
              exercise_name: updatedExercise.name,
              weight_lbs: Number.parseFloat(updatedExercise.weight_lbs.toFixed(2)),
            })
          }
        }
      }
    }

    if (body.status) {
      const workoutPatch: Record<string, unknown> = { status: body.status }
      if (body.status === "completed") {
        workoutPatch.completed_at = new Date().toISOString()
      } else if (body.status === "active") {
        workoutPatch.completed_at = null
      }

      const { data, error } = await supabase.from("workouts").update(workoutPatch).eq("id", workoutId).select("id")
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      if (!data?.length) {
        return NextResponse.json({ error: `workout ${workoutId} was not found` }, { status: 404 })
      }
    }

    const { data: workout, error: workoutError } = await supabase
      .from("workouts")
      .select("*")
      .eq("id", workoutId)
      .single()

    if (workoutError) {
      return NextResponse.json({ error: workoutError.message }, { status: 500 })
    }

    if (completedWeightUpdates.length > 0) {
      const dedupedWeights = new Map<string, number>()
      for (const update of completedWeightUpdates) {
        dedupedWeights.set(normalizeExerciseName(update.exercise_name), update.weight_lbs)
      }

      const now = new Date().toISOString()
      const weightRows = Array.from(dedupedWeights.entries()).map(([exercise_name, weight_lbs]) => ({
        user_id: workout.user_id,
        exercise_name,
        weight_lbs,
        last_used_at: now,
        updated_at: now,
      }))

      const { error: weightError } = await supabase
        .from("exercise_weights")
        .upsert(weightRows, { onConflict: "user_id,exercise_name" })

      if (weightError) {
        return NextResponse.json({ error: weightError.message }, { status: 500 })
      }
    }

    const { data: exercises, error: exercisesError } = await supabase
      .from("workout_exercises")
      .select("*")
      .eq("workout_id", workoutId)
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
