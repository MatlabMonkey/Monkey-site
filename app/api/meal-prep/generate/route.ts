import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const anthropicKey = process.env.ANTHROPIC_SECRET_API_KEY || process.env.ANTHROPIC_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

function pickProtein() {
  const rand = Math.random();
  if (rand < 0.7) return 'chicken';
  if (rand < 0.9) return 'tofu';
  return 'beef';
}

function getMealPrepPrompt(protein: string) {
  return `You are a meal prep expert designing recipes for a specific person.

USER PROFILE:
- 210 lbs, ~175 lbs lean mass
- Total daily burn: ~3,000 calories
- Eats 2-3 meals per day from this prep
- Daily protein goal: 120g+ minimum

PER-SERVING TARGETS (10 servings total):
- Calories: 1,100–1,200 kcal per serving
- Protein: 55–65g per serving
- This means LARGE portions — do not undersize

CONSTRAINTS:
- Total cook time: under 90 minutes (including prep)
- Must include: protein + vegetable + carb in every serving
- Must be meal-prep friendly (stores 5+ days in fridge, reheats well)
- Budget: LOW COST — prioritize bulk staples
- Simplicity: minimize specialty ingredients or expensive sauces

INGREDIENT GUIDELINES:
- Rice is essentially free — use generously (2+ cups dry per batch is fine)
- Chicken breast is extremely cheap — use large quantities (5+ lbs if needed)
- Assume all basic seasonings are already stocked (salt, pepper, garlic powder, onion powder, cumin, paprika, chili powder, soy sauce, oil, etc.)
- Only list seasonings/sauces that are unusual or need to be purchased
- Focus on bulk-buy condiments for flavor
- Vegetables should be cheap and in-season (broccoli, green beans, bell peppers, zucchini, cabbage, etc.)

PORTIONS MATTER:
- This feeds a 210 lb active male for the ENTIRE week
- Each serving should be genuinely filling — think restaurant-sized portions
- A typical serving should be ~2 cups rice + 8-10oz protein + 1.5 cups vegetables
- Total batch should use 5-7 lbs of protein, 4-5 cups dry rice, and 3-4 lbs of vegetables

This week's protein: ${protein.toUpperCase()}

The goal: well fed, good taste, minimal prep time, low cost.

Respond ONLY with valid JSON in this exact format:
{
  "recipe_name": "string",
  "protein_source": "${protein}",
  "cook_time_minutes": number,
  "ingredients": [
    {"item": "string", "amount": "string", "category": "protein|veg|carb|pantry"}
  ],
  "instructions": ["step 1", "step 2"],
  "macros": {
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "calories": number
  }
}

IMPORTANT: macros are PER SERVING. Ensure calories actually add up to 1,100-1,200 per serving given the ingredient quantities divided by 10.`;
}

export async function POST() {
  if (!anthropicKey) {
    return NextResponse.json({ error: 'ANTHROPIC_SECRET_API_KEY not configured' }, { status: 500 });
  }

  const protein = pickProtein();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
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
      return NextResponse.json({ error: `Anthropic error: ${error}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.content[0]?.text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse recipe' }, { status: 500 });
    }

    const recipe = JSON.parse(jsonMatch[0]);

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

    const { error: dbError } = await supabase
      .from('meal_prep_weekly')
      .upsert(payload, { onConflict: 'week_starting' });

    if (dbError) {
      return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ recipe: payload, message: 'Recipe generated!' });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
