CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideas_created_at ON ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_archived_created ON ideas(archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_pinned_created ON ideas(pinned, created_at DESC);

ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ideas"
  ON ideas FOR SELECT
  USING (true);

CREATE POLICY "No public insert ideas"
  ON ideas FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No public update ideas"
  ON ideas FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No public delete ideas"
  ON ideas FOR DELETE
  USING (false);
