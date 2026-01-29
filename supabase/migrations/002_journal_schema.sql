-- Journal schema: flexible entry + question catalog + answers
-- Supports one entry per date, stable question identities, and queryable answers.

-- 1. Journal entry: one per (user per) date. user_id nullable for v1; add auth later.
CREATE TABLE journal_entry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  is_draft BOOLEAN NOT NULL DEFAULT true,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_journal_entry_date ON journal_entry (date);
CREATE INDEX idx_journal_entry_is_draft_date ON journal_entry (is_draft, date);

-- 2. Question catalog: stable keys, wording can change over time.
CREATE TABLE question_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  question_type TEXT NOT NULL CHECK (question_type IN ('text','number','rating','boolean','multiselect','date')),
  wording TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_question_catalog_key ON question_catalog (key);
CREATE INDEX idx_question_catalog_display_order ON question_catalog (display_order);

-- 3. Answers: linked to entry + question. Typed value columns for querying.
CREATE TABLE journal_answer (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES journal_entry (id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES question_catalog (id),
  value_text TEXT,
  value_number NUMERIC,
  value_boolean BOOLEAN,
  value_json JSONB,
  CONSTRAINT journal_answer_entry_question_unique UNIQUE (entry_id, question_id)
);

CREATE INDEX idx_journal_answer_entry ON journal_answer (entry_id);
CREATE INDEX idx_journal_answer_question ON journal_answer (question_id);
CREATE INDEX idx_journal_answer_value_number ON journal_answer (question_id, value_number);

-- Full-text search on value_text
CREATE INDEX idx_journal_answer_value_text_fts ON journal_answer
  USING gin (to_tsvector('english', coalesce(value_text, '')));

-- RLS: private-by-default. v1 uses permissive policy; tighten when auth is added.
ALTER TABLE journal_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_answer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on journal_entry (v1)" ON journal_entry FOR ALL USING (true);
CREATE POLICY "Allow select on question_catalog" ON question_catalog FOR SELECT USING (true);
CREATE POLICY "Allow all on journal_answer (v1)" ON journal_answer FOR ALL USING (true);

-- Seed question_catalog (matches lib/journalSchema.ts)
INSERT INTO question_catalog (key, question_type, wording, description, display_order, metadata) VALUES
  ('summary', 'text', 'Daily summary', 'What did you do today?', 1, '{}'),
  ('reflection', 'text', 'Reflection / feelings', 'Feelings or meaning beyond the numbers', 2, '{}'),
  ('how_good', 'rating', 'How was your day?', 'Rate 1–10', 3, '{"min":1,"max":10,"step":0.5}'),
  ('productivity', 'rating', 'How productive were you?', 'Rate 1–10', 4, '{"min":1,"max":10,"step":0.5}'),
  ('drinks', 'number', 'Drinks', 'Number of alcoholic drinks', 5, '{"min":0,"max":20,"step":1}'),
  ('deep_work_hours', 'number', 'Deep work hours', 'Hours of focused work', 6, '{"min":0,"max":16,"step":0.5}'),
  ('rose', 'text', 'Rose', 'Highlight of the day', 7, '{}'),
  ('bud', 'text', 'Bud', 'Something to look forward to', 8, '{}'),
  ('thorn', 'text', 'Thorn', 'Something that could have been better', 9, '{}'),
  ('gratitude', 'text', 'Gratitude', 'What are you grateful for?', 10, '{}'),
  ('proud_of', 'text', 'Proud of', 'What are you proud of today?', 11, '{}'),
  ('thought_of_day', 'text', 'Thought of the day', 'What''s on your mind?', 12, '{}'),
  ('met_person', 'text', 'Met someone notable?', 'People you connected with', 13, '{}'),
  ('raok', 'text', 'Random act of kindness', 'Did you do one? Describe if so.', 14, '{}'),
  ('goals', 'text', 'Goals', 'Goals or intentions', 15, '{}'),
  ('booleans', 'multiselect', 'Habits / activities', 'Select all that apply', 16, '{"options":["Push","Pull","Legs","Full body","Surfing","Core","Cardio","Watch sunset","Guitar","Read ten pages"]}'),
  ('scount', 'number', 'S-count (or other count)', 'Optional numeric tracker', 17, '{"min":0,"max":100,"step":1}');
