#!/usr/bin/env node
/**
 * Anthropic Usage Backfill Script
 * Fetches last 30 days of usage from Anthropic API and populates Supabase
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

// Anthropic model mapping to our naming
const MODEL_MAP = {
  'claude-opus-4-6-20251101': 'claude-opus-4-6',
  'claude-sonnet-4-6-20251101': 'claude-sonnet-4-6',
  'claude-opus-4-5': 'claude-opus-4-5',
  'claude-sonnet-4-5': 'claude-sonnet-4-5',
};

async function fetchAnthropicUsage(startDate, endDate) {
  const url = new URL('https://api.anthropic.com/v1/usage');
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);

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

  return true;
}

async function main() {
  // Calculate date range (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  console.log(`Fetching Anthropic usage from ${startStr} to ${endStr}...`);

  try {
    const usage = await fetchAnthropicUsage(startStr, endStr);
    console.log('Raw usage data:', JSON.stringify(usage, null, 2));

    // Transform Anthropic data to our schema
    // Note: Anthropic returns data in different formats depending on account type
    // This handles the common response structure
    const records = [];

    if (usage.data && Array.isArray(usage.data)) {
      for (const day of usage.data) {
        const date = day.date;

        // Anthropic returns usage by model
        for (const [modelKey, modelData] of Object.entries(day.usage || {})) {
          const model = MODEL_MAP[modelKey] || modelKey;
          records.push({
            date,
            provider: 'anthropic',
            model,
            tokens_in: modelData.input_tokens || 0,
            tokens_out: modelData.output_tokens || 0,
            cost_usd: modelData.cost || 0,
          });
        }
      }
    }

    // Also add zero entries for Kimi and Ollama to show they're tracked
    // (even if we don't have real data for Kimi)
    for (let i = 0; i <= 30; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      // Ollama is always zero cost
      records.push({
        date: dateStr,
        provider: 'ollama',
        model: 'qwen2.5-coder:7b',
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
      });

      // Kimi placeholder (we don't track this due to cost)
      records.push({
        date: dateStr,
        provider: 'moonshot',
        model: 'kimi-k2.5',
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
      });
    }

    if (records.length > 0) {
      console.log(`Upserting ${records.length} records...`);
      await upsertToSupabase(records);
      console.log('✅ Backfill complete');
    } else {
      console.log('No usage data returned from Anthropic');
    }

  } catch (err) {
    console.error('❌ Backfill failed:', err.message);
    process.exit(1);
  }
}

main();
