-- Usage tracking table for Arias dashboard
CREATE TABLE IF NOT EXISTS usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  provider TEXT NOT NULL, -- 'anthropic', 'moonshot', 'ollama'
  model TEXT NOT NULL, -- 'claude-opus-4-6', 'claude-sonnet-4-6', 'kimi-k2.5', etc.
  tokens_in BIGINT DEFAULT 0,
  tokens_out BIGINT DEFAULT 0,
  cost_usd DECIMAL(10, 4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, provider, model)
);

-- Index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_usage_daily_date ON usage_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_daily_provider ON usage_daily(provider);

-- Enable RLS
ALTER TABLE usage_daily ENABLE ROW LEVEL SECURITY;

-- Public read access (for dashboard display)
CREATE POLICY "Public read usage" ON usage_daily FOR SELECT USING (true);

-- No public insert/update (only via service role or cron)
CREATE POLICY "No public insert" ON usage_daily FOR INSERT USING (false);
CREATE POLICY "No public update" ON usage_daily FOR UPDATE USING (false);
CREATE POLICY "No public delete" ON usage_daily FOR DELETE USING (false);
