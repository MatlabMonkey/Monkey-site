"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Clock, Users, Flame, Check, ShoppingCart, ChefHat, RefreshCw, Loader2 } from "lucide-react"

interface Ingredient {
  item: string
  amount: string
  category: "protein" | "veg" | "carb" | "pantry"
}

interface Macros {
  protein_g: number
  carbs_g: number
  fat_g: number
  calories: number
}

interface Recipe {
  week_starting: string
  recipe_name: string
  protein_source: string
  meals_yield: number
  cook_time_minutes: number
  ingredients: Ingredient[]
  instructions: string[]
  macros: Macros
}

const categoryColors: Record<string, string> = {
  protein: "border-[rgb(var(--brand)_/_0.45)] bg-[rgb(var(--brand-weak)_/_0.7)] text-[rgb(var(--brand))]",
  veg: "border-emerald-500/30 bg-emerald-900/20 text-emerald-300",
  carb: "border-amber-500/30 bg-amber-900/20 text-amber-300",
  pantry: "border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--text-muted))]",
}

const categoryLabels: Record<string, string> = {
  protein: "Protein",
  veg: "Vegetables",
  carb: "Carbs",
  pantry: "Pantry",
}

export default function MealPrepPage() {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const fetchLatestRecipe = useCallback(async ({ showLoading = false, resetChecklist = false }: { showLoading?: boolean; resetChecklist?: boolean } = {}) => {
    if (showLoading) setLoading(true)

    try {
      const res = await fetch(`/api/meal-prep?t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch meal prep recipe')
      }

      setRecipe(data.recipe ?? null)

      if (resetChecklist) {
        setCheckedItems(new Set())
      }

      return data.recipe ?? null
    } catch (err: any) {
      const message = err?.message || 'Unable to load meal prep recipe right now.'
      setError(message)
      console.error('Failed to fetch recipe:', err)
      return null
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchLatestRecipe({ showLoading: true })
  }, [fetchLatestRecipe])

  const generateRecipe = async () => {
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/meal-prep/generate', {
        method: 'POST',
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.recipe) {
        throw new Error(data.error || 'Failed to generate a new meal prep recipe')
      }

      // Re-fetch canonical data after mutation to prevent stale UI/race conditions.
      const latest = await fetchLatestRecipe({ resetChecklist: true })

      // Fallback to response payload if canonical fetch fails.
      if (!latest) {
        setRecipe(data.recipe)
        setCheckedItems(new Set())
      }
    } catch (err: any) {
      const message = err?.message || 'Unable to generate a new recipe right now.'
      setError(message)
      console.error('Failed to generate recipe:', err)
    } finally {
      setGenerating(false)
    }
  }

  const toggleItem = (item: string) => {
    const newChecked = new Set(checkedItems)
    if (newChecked.has(item)) newChecked.delete(item)
    else newChecked.add(item)
    setCheckedItems(newChecked)
  }

  const groupedIngredients = recipe?.ingredients.reduce((acc, ing) => {
    if (!acc[ing.category]) acc[ing.category] = []
    acc[ing.category].push(ing)
    return acc
  }, {} as Record<string, Ingredient[]>)

  if (loading) {
    return (
      <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-32 bg-[rgb(var(--surface-2))] rounded" />
            <div className="h-12 w-3/4 bg-[rgb(var(--surface-2))] rounded" />
          </div>
        </div>
      </main>
    )
  }

  if (!recipe) {
    return (
      <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tools
          </Link>

          <div className="mt-12 text-center">
            <ChefHat className="w-16 h-16 mx-auto text-[rgb(var(--brand))] mb-4" />
            <h1 className="text-3xl font-bold mb-2">No Recipe Yet</h1>
            <p className="text-[rgb(var(--text-muted))] max-w-md mx-auto mb-6">
              Your weekly meal prep recipe will appear here Sunday at 9am.
              Or generate one now!
            </p>
            {error && (
              <p className="mb-4 text-sm text-red-300">{error}</p>
            )}
            <button
              onClick={generateRecipe}
              disabled={generating}
              className="px-6 py-3 rounded-full bg-[rgb(var(--brand))] text-[rgb(var(--bg))] font-semibold hover:bg-[rgb(var(--brand-strong))] transition-colors disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Recipe'}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      {/* Loading Overlay */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(var(--bg)_/_0.85)] backdrop-blur-sm">
          <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[rgb(var(--brand))] mx-auto mb-4" />
            <p className="text-lg font-semibold">Cooking up something tasty...</p>
            <p className="text-sm text-[rgb(var(--text-muted))] mt-2">This takes about 10-15 seconds</p>
          </div>
        </div>
      )}
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Link>

        <header className="mt-6 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide border ${categoryColors[recipe.protein_source] || categoryColors.pantry}`}>
              {recipe.protein_source}
            </span>
            <span className="text-[rgb(var(--text-muted))] text-sm">
              Week of {new Date(recipe.week_starting).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold">{recipe.recipe_name}</h1>
            <button
              onClick={generateRecipe}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2))] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title="Generate new recipe"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[rgb(var(--brand))]" />
                  <span className="text-sm font-medium">Generating...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 text-[rgb(var(--text-muted))]" />
                  <span className="text-sm font-medium text-[rgb(var(--text-muted))]">New Recipe</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-300">{error}</p>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-2 text-[rgb(var(--text-muted))]">
              <Clock className="w-4 h-4" />
              <span>{recipe.cook_time_minutes} min cook</span>
            </div>
            <div className="flex items-center gap-2 text-[rgb(var(--text-muted))]">
              <Users className="w-4 h-4" />
              <span>{recipe.meals_yield} meals</span>
            </div>
            <div className="flex items-center gap-2 text-[rgb(var(--text-muted))]">
              <Flame className="w-4 h-4" />
              <span>{recipe.macros.calories} cal/serving</span>
            </div>
          </div>

          {/* Macros */}
          <div className="flex gap-6 mt-4 text-sm">
            <div>
              <span className="text-[rgb(var(--text-muted))]">Protein</span>
              <p className="font-mono font-semibold">{recipe.macros.protein_g}g</p>
            </div>
            <div>
              <span className="text-[rgb(var(--text-muted))]">Carbs</span>
              <p className="font-mono font-semibold">{recipe.macros.carbs_g}g</p>
            </div>
            <div>
              <span className="text-[rgb(var(--text-muted))]">Fat</span>
              <p className="font-mono font-semibold">{recipe.macros.fat_g}g</p>
            </div>
          </div>
        </header>

        {/* Shopping List */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <ShoppingCart className="w-5 h-5 text-[rgb(var(--brand))]" />
            <h2 className="text-xl font-semibold">Shopping List</h2>
            <span className="text-sm text-[rgb(var(--text-muted))]">
              ({checkedItems.size}/{recipe.ingredients.length} checked)
            </span>
          </div>

          <div className="space-y-4">
            {groupedIngredients && Object.entries(groupedIngredients).map(([category, items]) => (
              <div key={category} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
                <h3 className="text-xs uppercase tracking-wide text-[rgb(var(--text-muted))] mb-3">
                  {categoryLabels[category]}
                </h3>
                <ul className="space-y-2">
                  {items.map((ing, i) => {
                    const key = `${category}-${i}`
                    const isChecked = checkedItems.has(key)
                    return (
                      <li
                        key={key}
                        onClick={() => toggleItem(key)}
                        className={`flex items-center gap-3 cursor-pointer group ${isChecked ? 'opacity-50' : ''}`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-[rgb(var(--brand))] border-[rgb(var(--brand))]'
                            : 'border-[rgb(var(--border))] group-hover:border-[rgb(var(--brand))]'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 text-[rgb(var(--bg))]" />}
                        </div>
                        <span className={isChecked ? 'line-through' : ''}>
                          <span className="font-medium">{ing.item}</span>
                          <span className="text-[rgb(var(--text-muted))] ml-2">{ing.amount}</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Instructions */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <ChefHat className="w-5 h-5 text-[rgb(var(--brand))]" />
            <h2 className="text-xl font-semibold">Instructions</h2>
          </div>

          <div className="space-y-3">
            {recipe.instructions.map((step, i) => (
              <div
                key={i}
                className="flex gap-4 p-4 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgb(var(--brand-weak)_/_0.7)] border border-[rgb(var(--brand)_/_0.45)] text-[rgb(var(--brand))] flex items-center justify-center font-mono font-semibold text-sm">
                  {i + 1}
                </span>
                <p className="text-[rgb(var(--text))] leading-relaxed pt-1">{step}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
