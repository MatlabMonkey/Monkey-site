CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  author_label TEXT DEFAULT 'Anonymous',
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON questions FOR SELECT USING (true);
CREATE POLICY "Public insert" ON questions FOR INSERT WITH CHECK (true);
CREATE POLICY "No public update" ON questions FOR UPDATE USING (false);
