#!/usr/bin/env node
/**
 * Weekly Meal Prep Generator
 * Runs Sundays at 9am to generate next week's meal prep recipe
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// Protein rotation: 70% chicken, 20% tofu, 10% beef
function pickProtein() {
  const rand = Math.random();
  if (rand < 0.7) return 'chicken';
  if (rand < 0.9) return 'tofu';
  return 'beef';
}

const protein = pickProtein();

const SYSTEM_PROMPT = `You are a meal prep expert. Generate a recipe that meets these requirements:
- Makes exactly 10 servings
- Total cook time under 90 minutes (including prep)
- Must include: protein, vegetable, and carb
- Must be meal-prep friendly (stores 5+ days in fridge)
- Use simple ingredients available at standard grocery stores
- Provide realistic macro estimates per serving

This week's protein: ${protein.toUpperCase()}

Respond ONLY with valid JSON in this exact format:
{
  "recipe_name": "string",
  "protein_source": "${protein}",
  "cook_time_minutes": number,
  "ingredients": [
    {"item": "string", "amount": "string", "category": "protein|veg|carb|pantry"}
  ],
  "instructions": ["step 1", "step 2", ...],
  "macros": {
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "calories": number
  }
}`;

async function generateRecipe() {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307', // cheapest option
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Generate this week's ${protein} meal prep recipe.`
      }]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text;
  
  try {
    // Extract JSON from response (in case there's any extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse recipe JSON:', content);
    throw e;
  }
}

async function saveToSupabase(recipe) {
  // Get next Sunday's date
  const today = new Date();
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + (7 - today.getDay()) % 7);
  if (nextSunday <= today) nextSunday.setDate(nextSunday.getDate() + 7);
  
  const weekStarting = nextSunday.toISOString().split('T')[0];

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
