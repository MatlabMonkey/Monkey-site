// Shared meal prep prompt for both cron and API route
// User profile: Zach, 210 lbs, ~175 lbs lean mass, 3000 cal/day burn

function pickProtein() {
  const rand = Math.random();
  if (rand < 0.7) return 'chicken';
  if (rand < 0.9) return 'tofu';
  return 'beef';
}

function getMealPrepPrompt(protein) {
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

module.exports = { pickProtein, getMealPrepPrompt };
