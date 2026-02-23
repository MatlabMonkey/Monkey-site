export type DayType = "Push" | "Pull" | "Legs" | "Upper" | "Lower" | "Full"

export interface WorkoutExercise {
  id: string
  workout_id: string
  name: string
  sets: number
  reps: string
  rest_seconds: number
  order_index: number
  status: "pending" | "completed" | "skipped"
  completed_sets: number
  notes: string | null
}

export interface Workout {
  id: string
  user_id: string
  day_type: DayType
  duration_minutes: number
  generated_at: string
  completed_at: string | null
  status: "active" | "completed" | "archived"
  exercises: WorkoutExercise[]
}

export interface GenerateWorkoutRequest {
  day_type: DayType
  duration_minutes: number
  notes?: string
  skiing_tomorrow?: boolean
}

export interface WorkoutApiResponse {
  activeWorkout: Workout | null
  history: Workout[]
}

export interface ExerciseMeta {
  block?: string
  start_minute?: number
  end_minute?: number
  cues?: string[]
  substitutions?: string[]
}
