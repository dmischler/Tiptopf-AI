import { z } from 'zod'

import type { RecipeImageCandidate } from '@/lib/ai/image-types'

const MEAL_DB_SEARCH_ENDPOINT = 'https://www.themealdb.com/api/json/v1/1/search.php'

const mealDbResponseSchema = z.object({
  meals: z
    .array(
      z.object({
        idMeal: z.string(),
        strMeal: z.string(),
        strMealThumb: z.string().url(),
      })
    )
    .nullable(),
})

export async function searchMealDbImages(query: string, limit = 4): Promise<RecipeImageCandidate[]> {
  const url = new URL(MEAL_DB_SEARCH_ENDPOINT)
  url.searchParams.set('s', query)

  const response = await fetch(url.toString(), { cache: 'no-store' })
  if (!response.ok) {
    return []
  }

  try {
    const parsed = mealDbResponseSchema.parse(await response.json())
    if (!parsed.meals || parsed.meals.length === 0) {
      return []
    }

    return parsed.meals.slice(0, Math.max(1, limit)).map((meal) => ({
      id: `mealdb-${meal.idMeal}`,
      source: 'mealdb' as const,
      url: meal.strMealThumb,
      thumbnailUrl: meal.strMealThumb,
      alt: meal.strMeal,
    }))
  } catch {
    return []
  }
}
