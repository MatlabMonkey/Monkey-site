-- Meal prep weekly table
CREATE TABLE IF NOT EXISTS meal_prep_weekly (
  week_starting DATE PRIMARY KEY,
  recipe_name TEXT NOT NULL,
  protein_source TEXT NOT NULL, -- 'chicken', 'tofu', 'beef'
  meals_yield INTEGER DEFAULT 10,
  cook_time_minutes INTEGER,
  ingredients JSONB NOT NULL, -- [{"item": "chicken breast", "amount": "3 lbs", "category": "protein"}]
  instructions TEXT[] NOT NULL, -- array of steps
  macros JSONB, -- {"protein_g": 120, "carbs_g": 80, "fat_g": 40, "calories": 1200}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient date lookup
CREATE INDEX IF NOT EXISTS idx_meal_prep_week_starting ON meal_prep_weekly(week_starting DESC);

-- Enable RLS
ALTER TABLE meal_prep_weekly ENABLE ROW LEVEL SECURITY;

-- Public read (anyone can view recipes)
CREATE POLICY "Public read meal prep" ON meal_prep_weekly FOR SELECT USING (true);

-- No public insert/update (cron only)
CREATE POLICY "No public insert" ON meal_prep_weekly FOR INSERT USING (false);
CREATE POLICY "No public update" ON meal_prep_weekly FOR UPDATE USING (false);
CREATE POLICY "No public delete" ON meal_prep_weekly FOR DELETE USING (false);
