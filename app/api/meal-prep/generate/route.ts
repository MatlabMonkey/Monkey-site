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

export async function POST() {
  if (!anthropicKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const protein = pickProtein();

  const systemPrompt = `You are a meal prep expert. Generate a recipe that meets these requirements:
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
  "instructions": ["step 1", "step 2"],
  "macros": {
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "calories": number
  }
}`;

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
        system: systemPrompt,
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

    // Save to Supabase with today's date as the week
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay()); // Current week's Sunday
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
