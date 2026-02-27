ALTER TABLE workout_exercises
ADD COLUMN IF NOT EXISTS weight_lbs REAL;

CREATE TABLE IF NOT EXISTS exercise_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL CHECK (length(btrim(exercise_name)) > 0),
  weight_lbs REAL NOT NULL CHECK (weight_lbs > 0),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, exercise_name)
);

CREATE INDEX IF NOT EXISTS idx_exercise_weights_user_last_used
  ON exercise_weights(user_id, last_used_at DESC);

ALTER TABLE exercise_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercise_weights_select_own"
  ON exercise_weights FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "exercise_weights_insert_own"
  ON exercise_weights FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "exercise_weights_update_own"
  ON exercise_weights FOR UPDATE
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "exercise_weights_delete_own"
  ON exercise_weights FOR DELETE
  USING (auth.uid()::TEXT = user_id);
