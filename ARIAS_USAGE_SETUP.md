# Arias Usage Setup

## Required Environment Variables

Add these to your Vercel dashboard (Settings > Environment Variables):

```
ANTHROPIC_API_KEY=sk-ant-api03-...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

Note: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` should already be set.

## Database Migration

Run the migration in Supabase SQL Editor:
```sql
-- File: supabase/migrations/005_usage_daily.sql
```

## Historical Backfill (One-time)

```bash
# Run locally with credentials
export ANTHROPIC_API_KEY="sk-ant-api03-..."
export NEXT_PUBLIC_SUPABASE_URL="https://eeyflurpaqctuseqpsrx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIs..."
node scripts/backfill-anthropic-usage.js
```

Or run via Vercel CLI:
```bash
vercel env pull .env.local
node scripts/backfill-anthropic-usage.js
```

## Daily Cron

Add to OpenClaw config (openclaw.json):
```json
"cron": {
  "jobs": [
    {
      "id": "daily-anthropic-sync",
      "schedule": "0 0 * * *",
      "command": "cd ~/Monkey-site && node scripts/daily-usage-sync.js",
      "enabled": true
    }
  ]
}
```

Then restart the gateway: `openclaw gateway restart`

## What Gets Tracked

- ✅ Anthropic (Sonnet, Opus) — real API data
- ➖ Kimi/Moonshot — displayed as $0 (tracking too expensive)
- ✅ Ollama — displayed as $0 (local, no cost)

## API Endpoint

- `/api/usage?days=30` — returns aggregated usage data
