import { z } from 'zod'

import { categorySchema, difficultySchema } from '@/lib/recipe-schema'
import type { ParsedRecipe } from '@/types'

export const aiRecipeSchema = z.object({
  title: z.string().min(1, 'Titel fehlt im extrahierten Rezept.'),
  ingredients: z.array(z.string()).min(1, 'Zutatenliste fehlt im extrahierten Rezept.'),
  instructions: z.string().min(1, 'Zubereitung fehlt im extrahierten Rezept.'),
  prepTime: z.number().int().nullable(),
  cookTime: z.number().int().nullable(),
  servings: z.number().int().nullable(),
  category: categorySchema,
  difficulty: difficultySchema,
  tags: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
})

export type AiRecipe = z.infer<typeof aiRecipeSchema>

export function toParsedRecipe(recipe: AiRecipe, sourceType: 'image' | 'url'): ParsedRecipe {
  return {
    title: recipe.title,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    prep_time: recipe.prepTime,
    cook_time: recipe.cookTime,
    servings: recipe.servings,
    category: recipe.category,
    difficulty: recipe.difficulty,
    confidence: recipe.confidence,
    tags: recipe.tags,
    source_type: sourceType,
  }
}
