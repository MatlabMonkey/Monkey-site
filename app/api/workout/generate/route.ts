import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { WORKOUT_SYSTEM_PROMPT } from "@/lib/workoutSystemPrompt"

export const runtime = "edge"

type GenerateRequest = {
  user_id?: string
  day_type: "Push" | "Pull" | "Legs" | "Upper" | "Lower" | "Full"
  duration_minutes: number
  notes?: string
}

type GeneratedExercise = {
  name: string
  sets: number
  reps: string
  rest_seconds: number
  cues?: string[]
  substitutions?: string[]
}

type GeneratedBlock = {
  name: string
  start_minute: number
  end_minute: number
  exercises: GeneratedExercise[]
}

type GeneratedWorkout = {
  title: string
  warmup?: Array<{
    name: string
    duration_minutes?: number
    cues?: string[]
    substitutions?: string[]
  }>
  blocks: GeneratedBlock[]
  notes?: string[]
}

function sanitizeWorkout(raw: unknown): GeneratedWorkout {
  const fallback: GeneratedWorkout = {
    title: "Generated Workout",
    warmup: [],
    blocks: [],
    notes: [],
  }

  if (!raw || typeof raw !== "object") return fallback

  const parsed = raw as Record<string, unknown>
  const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : []

  return {
    title: typeof parsed.title === "string" ? parsed.title : fallback.title,
    warmup: Array.isArray(parsed.warmup)
      ? parsed.warmup
          .filter((w) => w && typeof w === "object")
          .map((w) => {
            const warm = w as Record<string, unknown>
            return {
              name: String(warm.name ?? "Warm-up"),
              duration_minutes: typeof warm.duration_minutes === "number" ? warm.duration_minutes : 3,
              cues: Array.isArray(warm.cues) ? warm.cues.map(String) : [],
              substitutions: Array.isArray(warm.substitutions) ? warm.substitutions.map(String) : [],
            }
          })
      : [],
    blocks: blocks
      .filter((b) => b && typeof b === "object")
      .map((b, index) => {
        const block = b as Record<string, unknown>
        const exercises = Array.isArray(block.exercises) ? block.exercises : []
        return {
          name: typeof block.name === "string" ? block.name : `Block ${index + 1}`,
          start_minute: typeof block.start_minute === "number" ? block.start_minute : index * 10,
          end_minute: typeof block.end_minute === "number" ? block.end_minute : index * 10 + 10,
          exercises: exercises
            .filter((e) => e && typeof e === "object")
            .map((e, exerciseIndex) => {
              const ex = e as Record<string, unknown>
              const sets = Number(ex.sets)
              const rest = Number(ex.rest_seconds)
              return {
                name: typeof ex.name === "string" ? ex.name : `Exercise ${exerciseIndex + 1}`,
                sets: Number.isFinite(sets) && sets > 0 ? sets : 3,
                reps: typeof ex.reps === "string" ? ex.reps : "8-12",
                rest_seconds: Number.isFinite(rest) && rest >= 0 ? rest : 75,
                cues: Array.isArray(ex.cues) ? ex.cues.map(String) : [],
                substitutions: Array.isArray(ex.substitutions) ? ex.substitutions.map(String) : [],
              }
            }),
        }
      })
      .filter((block) => block.exercises.length > 0),
    notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
  }
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error("Claude response did not include JSON")
  return JSON.parse(match[0])
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequest
    const userId = body.user_id?.trim() || request.headers.get("x-user-id") || "demo-user"

    if (!body.day_type) {
      return NextResponse.json({ error: "day_type is required" }, { status: 400 })
    }

    if (!body.duration_minutes || body.duration_minutes < 20 || body.duration_minutes > 90) {
      return NextResponse.json({ error: "duration_minutes must be between 20 and 90" }, { status: 400 })
    }

    const anthropicKey = process.env.ANTHROPIC_SECRET_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: "Anthropic API key is not configured" }, { status: 500 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase credentials are not configured" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const promptPayload = {
      day_type: body.day_type,
      duration_minutes: body.duration_minutes,
      notes: body.notes || "",
    }

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2200,
        system: WORKOUT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Generate a ${body.duration_minutes}-minute ${body.day_type} workout. Additional notes: ${body.notes || "none"}. Return JSON only.`,
          },
        ],
      }),
    })

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text()
      return NextResponse.json({ error: `Anthropic error: ${errorText}` }, { status: 500 })
    }

    const anthropicData = await anthropicResponse.json()
    const text = anthropicData?.content?.[0]?.text
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Anthropic response was empty" }, { status: 500 })
    }

    const parsed = sanitizeWorkout(extractJson(text))
    if (!parsed.blocks.length) {
      return NextResponse.json({ error: "Generated workout had no valid exercises" }, { status: 500 })
    }

    const { data: workout, error: workoutError } = await supabase
      .from("workouts")
      .insert({
        user_id: userId,
        day_type: body.day_type,
        duration_minutes: body.duration_minutes,
        status: "active",
      })
      .select()
      .single()

    if (workoutError || !workout) {
      return NextResponse.json({ error: workoutError?.message || "Failed to insert workout" }, { status: 500 })
    }

    const flattened = parsed.blocks.flatMap((block, blockIndex) =>
      block.exercises.map((exercise, exerciseIndex) => ({
        workout_id: workout.id,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        rest_seconds: exercise.rest_seconds,
        order_index: blockIndex * 100 + exerciseIndex,
        status: "pending",
        completed_sets: 0,
        notes: JSON.stringify({
          block: block.name,
          start_minute: block.start_minute,
          end_minute: block.end_minute,
          cues: exercise.cues || [],
          substitutions: exercise.substitutions || [],
        }),
      })),
    )

    const { data: exercises, error: exerciseError } = await supabase
      .from("workout_exercises")
      .insert(flattened)
      .select()
      .order("order_index", { ascending: true })

    if (exerciseError) {
      await supabase.from("workouts").delete().eq("id", workout.id)
      return NextResponse.json({ error: exerciseError.message }, { status: 500 })
    }

    return NextResponse.json({
      workout,
      exercises: exercises || [],
      ai_plan: parsed,
      request: promptPayload,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    )
  }
}
