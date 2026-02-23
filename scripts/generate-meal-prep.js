#!/usr/bin/env node
/**
 * Weekly Meal Prep Generator
 * Runs Sundays at 9am to generate next week's meal prep recipe
 */

const { pickProtein, getMealPrepPrompt } = require('../lib/mealPrepPrompt');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_SECRET_API_KEY || process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const protein = pickProtein();

async function generateRecipe() {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      system: getMealPrepPrompt(protein),
      messages: [{ role: 'user', content: `Generate this week's ${protein} meal prep recipe.` }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response');
  return JSON.parse(jsonMatch[0]);
}

async function saveToSupabase(recipe) {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  const weekStarting = sunday.toISOString().split('T')[0];

  const payload = {
    week_starting: weekStarting,
    recipe_name: recipe.recipe_name,
    protein_source: recipe.protein_source,
    meals_yield: 10,
    cook_time_minutes: recipe.cook_time_minutes,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    macros: recipe.macros,
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/meal_prep_weekly`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${response.status} ${error}`);
  }

  return weekStarting;
}

async function main() {
  console.log(`Generating ${protein} meal prep recipe...`);
  try {
    const recipe = await generateRecipe();
    console.log('Generated:', recipe.recipe_name);
    const weekStarting = await saveToSupabase(recipe);
    console.log(`✅ Saved for week starting ${weekStarting}`);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

main();
