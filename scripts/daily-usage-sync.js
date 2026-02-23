#!/usr/bin/env node
/**
 * Daily Anthropic Usage Sync
 * Runs once per day to fetch yesterday's usage
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_SECRET_API_KEY || process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const MODEL_MAP = {
  'claude-opus-4-6-20251101': 'claude-opus-4-6',
  'claude-sonnet-4-6-20251101': 'claude-sonnet-4-6',
};

async function fetchAnthropicUsage(date) {
  const url = new URL('https://api.anthropic.com/v1/usage');
  url.searchParams.set('date', date);

  const response = await fetch(url.toString(), {
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  return response.json();
}

async function upsertToSupabase(records) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/usage_daily`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(records),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${response.status} ${error}`);
  }
}

async function main() {
  // Yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  console.log(`Syncing Anthropic usage for ${dateStr}...`);

  try {
    const usage = await fetchAnthropicUsage(dateStr);
    const records = [];

    if (usage.data && Array.isArray(usage.data)) {
      for (const day of usage.data) {
        for (const [modelKey, modelData] of Object.entries(day.usage || {})) {
          const model = MODEL_MAP[modelKey] || modelKey;
          records.push({
            date: dateStr,
            provider: 'anthropic',
            model,
            tokens_in: modelData.input_tokens || 0,
            tokens_out: modelData.output_tokens || 0,
            cost_usd: modelData.cost || 0,
          });
        }
      }
    }

    if (records.length > 0) {
      await upsertToSupabase(records);
      console.log(`✅ Synced ${records.length} records for ${dateStr}`);
    } else {
      console.log('No usage data for this date');
    }

  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
  }
}

main();
