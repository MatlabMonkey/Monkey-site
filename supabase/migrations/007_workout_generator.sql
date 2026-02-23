CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workout_profiles (
  user_id TEXT PRIMARY KEY,
  split_type TEXT NOT NULL,
  equipment TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  injuries TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  goals TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  day_type TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 20 AND 180),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived'))
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INTEGER NOT NULL CHECK (sets > 0),
  reps TEXT NOT NULL,
  rest_seconds INTEGER NOT NULL DEFAULT 60 CHECK (rest_seconds >= 0),
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  completed_sets INTEGER NOT NULL DEFAULT 0 CHECK (completed_sets >= 0),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_generated ON workouts(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_status ON workouts(status);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_order ON workout_exercises(workout_id, order_index ASC);

ALTER TABLE workout_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_profiles_select_own"
  ON workout_profiles FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "workout_profiles_insert_own"
  ON workout_profiles FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "workout_profiles_update_own"
  ON workout_profiles FOR UPDATE
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "workout_profiles_delete_own"
  ON workout_profiles FOR DELETE
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "workouts_select_own"
  ON workouts FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "workouts_insert_own"
  ON workouts FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "workouts_update_own"
  ON workouts FOR UPDATE
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "workouts_delete_own"
  ON workouts FOR DELETE
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "workout_exercises_select_own"
  ON workout_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_exercises.workout_id
      AND w.user_id = auth.uid()::TEXT
    )
  );

CREATE POLICY "workout_exercises_insert_own"
  ON workout_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_exercises.workout_id
      AND w.user_id = auth.uid()::TEXT
    )
  );

CREATE POLICY "workout_exercises_update_own"
  ON workout_exercises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_exercises.workout_id
      AND w.user_id = auth.uid()::TEXT
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_exercises.workout_id
      AND w.user_id = auth.uid()::TEXT
    )
  );

CREATE POLICY "workout_exercises_delete_own"
  ON workout_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_exercises.workout_id
      AND w.user_id = auth.uid()::TEXT
    )
  );
