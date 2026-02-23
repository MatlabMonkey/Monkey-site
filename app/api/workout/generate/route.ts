import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { WORKOUT_SYSTEM_PROMPT } from "@/lib/workoutSystemPrompt"

export const runtime = "edge"

const DAY_TYPES = ["Push", "Pull", "Legs", "Upper", "Lower", "Full"] as const
const MIN_DURATION_MINUTES = 20
const MAX_DURATION_MINUTES = 180
const USER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/

type GenerateRequest = {
  user_id?: string
  day_type?: (typeof DAY_TYPES)[number]
  duration_minutes?: number
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

type ErrorDetails = {
  message: string
  code?: string
  cause?: unknown
  stack?: string
  context?: Record<string, unknown>
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function normalizeUserId(bodyUserId: unknown, headerUserId: string | null): string | null {
  const candidate = typeof bodyUserId === "string" ? bodyUserId.trim() : (headerUserId?.trim() ?? "")
  if (!candidate) return "demo-user"
  return USER_ID_PATTERN.test(candidate) ? candidate : null
}

function isValidDayType(dayType: unknown): dayType is (typeof DAY_TYPES)[number] {
  return typeof dayType === "string" && DAY_TYPES.includes(dayType as (typeof DAY_TYPES)[number])
}

function sanitizeWorkout(raw: unknown): GeneratedWorkout {
  const fallback: GeneratedWorkout = {
    title: "Generated Workout",
    warmup: [],
    blocks: [],
    notes: [],
  }

  if (!isObjectRecord(raw)) return fallback

  const parsed = raw
  const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : []

  return {
    title: typeof parsed.title === "string" ? parsed.title : fallback.title,
    warmup: Array.isArray(parsed.warmup)
      ? parsed.warmup
          .filter(isObjectRecord)
          .map((w) => {
            const warm = w
            const duration = Number(warm.duration_minutes)
            return {
              name: String(warm.name ?? "Warm-up"),
              duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : 3,
              cues: Array.isArray(warm.cues) ? warm.cues.map(String) : [],
              substitutions: Array.isArray(warm.substitutions) ? warm.substitutions.map(String) : [],
            }
          })
      : [],
    blocks: blocks
      .filter(isObjectRecord)
      .map((b, index) => {
        const block = b
        const exercises = Array.isArray(block.exercises) ? block.exercises : []
        const startMinute = Number(block.start_minute)
        const endMinute = Number(block.end_minute)
        return {
          name: typeof block.name === "string" ? block.name : `Block ${index + 1}`,
          start_minute: Number.isFinite(startMinute) ? startMinute : index * 10,
          end_minute: Number.isFinite(endMinute) ? endMinute : index * 10 + 10,
          exercises: exercises
            .filter(isObjectRecord)
            .map((e, exerciseIndex) => {
              const ex = e
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
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue
    for (let end = text.length - 1; end > start; end -= 1) {
      if (text[end] !== "}") continue
      const candidate = text.slice(start, end + 1)
      try {
        return JSON.parse(candidate)
      } catch {
        // Continue searching for the first parseable JSON object.
      }
    }
  }

  throw new Error("Claude response did not include valid JSON")
}

function toErrorDetails(error: unknown, context?: Record<string, unknown>): ErrorDetails {
  if (error instanceof Error) {
    const base = {
      message: error.message,
      cause: error.cause,
      stack: error.stack,
      context,
    }

    if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
      return { ...base, code: (error as { code: string }).code }
    }

    return base
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
    context: {
      ...(context || {}),
      raw_error: error,
    },
  }
}

function errorResponse(status: number, error: unknown, context?: Record<string, unknown>) {
  const details = toErrorDetails(error, context)
  console.error("[workout/generate] Error", details)
  return NextResponse.json({ error: details.message, details }, { status })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequest
    const userId = normalizeUserId(body.user_id, request.headers.get("x-user-id"))
    if (!userId) {
      return NextResponse.json({ error: "user_id contains invalid characters" }, { status: 400 })
    }

    if (!isValidDayType(body.day_type)) {
      return NextResponse.json({ error: "day_type must be one of Push, Pull, Legs, Upper, Lower, Full" }, { status: 400 })
    }
    const dayType = body.day_type

    const durationMinutes = body.duration_minutes

    if (
      typeof durationMinutes !== "number" ||
      !Number.isFinite(durationMinutes) ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < MIN_DURATION_MINUTES ||
      durationMinutes > MAX_DURATION_MINUTES
    ) {
      return NextResponse.json(
        { error: `duration_minutes must be an integer between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES}` },
        { status: 400 },
      )
    }

    if (body.notes !== undefined && typeof body.notes !== "string") {
      return NextResponse.json({ error: "notes must be a string when provided" }, { status: 400 })
    }

    const anthropicKey = process.env.ANTHROPIC_SECRET_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: "Anthropic API key is not configured" }, { status: 500 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase credentials are not configured" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const notes = body.notes?.trim()

    const promptPayload = {
      day_type: dayType,
      duration_minutes: durationMinutes,
      notes: notes || "",
    }

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_WORKOUT_MODEL || "claude-sonnet-4-6",
        max_tokens: 2200,
        system: WORKOUT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Generate a ${durationMinutes}-minute ${dayType} workout. Additional notes: ${notes || "none"}. Return JSON only.`,
          },
        ],
      }),
    })

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text()
      return errorResponse(
        anthropicResponse.status,
        new Error(`Anthropic request failed: ${anthropicResponse.status} ${anthropicResponse.statusText}`),
        {
          provider: "anthropic",
          endpoint: "https://api.anthropic.com/v1/messages",
          model: process.env.ANTHROPIC_WORKOUT_MODEL || "claude-sonnet-4-6",
          status: anthropicResponse.status,
          status_text: anthropicResponse.statusText,
          response_body: errorText,
          request_id: anthropicResponse.headers.get("request-id") || anthropicResponse.headers.get("x-request-id"),
        },
      )
    }

    const anthropicData = await anthropicResponse.json()
    const textParts = Array.isArray(anthropicData?.content)
      ? anthropicData.content
          .filter((part: unknown) => isObjectRecord(part) && typeof part.text === "string")
          .map((part: Record<string, unknown>) => String(part.text))
      : []

    const text = textParts.join("\n").trim()
    if (!text) {
      return errorResponse(500, new Error("Anthropic response was empty"), {
        provider: "anthropic",
        endpoint: "https://api.anthropic.com/v1/messages",
        model: process.env.ANTHROPIC_WORKOUT_MODEL || "claude-sonnet-4-6",
        raw_response: anthropicData,
      })
    }

    const parsed = sanitizeWorkout(extractJson(text))
    if (!parsed.blocks.length) {
      return errorResponse(500, new Error("Generated workout had no valid exercises"), {
        provider: "anthropic",
        parsed_workout: parsed,
        raw_text: text,
      })
    }

    const { data: workout, error: workoutError } = await supabase
      .from("workouts")
      .insert({
        user_id: userId,
        day_type: dayType,
        duration_minutes: durationMinutes,
        status: "active",
      })
      .select()
      .single()

    if (workoutError || !workout) {
      return errorResponse(500, new Error(workoutError?.message || "Failed to insert workout"), {
        provider: "supabase",
        operation: "insert_workout",
        supabase_error: workoutError,
      })
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
      return errorResponse(500, new Error(exerciseError.message), {
        provider: "supabase",
        operation: "insert_exercises",
        supabase_error: exerciseError,
      })
    }

    return NextResponse.json({
      workout,
      exercises: exercises || [],
      ai_plan: parsed,
      request: promptPayload,
    })
  } catch (error) {
    return errorResponse(500, error, { route: "app/api/workout/generate" })
  }
}
