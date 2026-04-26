'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  createRecipe,
  deleteRecipe,
  updateRecipe,
  updateRecipeFavorite,
  updateRecipeImage,
  updateRecipeRating,
} from '@/lib/local/store'

const recipeIdSchema = z.string().uuid()
const favoriteSchema = z.boolean()
const ratingSchema = z.number().int().min(0).max(5)
const categorySchema = z.enum(['starter', 'main', 'dessert', 'side', 'breakfast', 'snack'])
const difficultySchema = z.enum(['easy', 'medium', 'hard'])

const editRecipeSchema = z.object({
  title: z.string().trim().min(1).optional(),
  ingredients: z.array(z.string()).optional(),
  instructions: z.string().trim().min(1).optional(),
  prep_time: z.number().int().min(0).nullable().optional(),
  cook_time: z.number().int().min(0).nullable().optional(),
  servings: z.number().int().min(1).nullable().optional(),
  category: categorySchema.optional(),
  difficulty: difficultySchema.optional(),
  tags: z.array(z.string()).optional(),
})

const restoreRecipeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1),
  ingredients: z.array(z.string()),
  instructions: z.string().trim().min(1),
  prep_time: z.number().int().min(0),
  cook_time: z.number().int().min(0),
  servings: z.number().int().min(1),
  category: categorySchema,
  difficulty: difficultySchema,
  rating: z.number().int().min(0).max(5).nullable(),
  is_favorite: z.boolean(),
  image_url: z.string().nullable(),
  source_url: z.string().nullable(),
  source_type: z.enum(['image', 'url', 'manual']),
  tags: z.array(z.string()).optional(),
})

export async function toggleFavorite(recipeId: string, isFavorite: boolean) {
  const parsedRecipeId = recipeIdSchema.parse(recipeId)
  const parsedFavorite = favoriteSchema.parse(isFavorite)
  const data = await updateRecipeFavorite(parsedRecipeId, parsedFavorite)

  if (!data) {
    throw new Error('Recipe not found')
  }

  revalidatePath('/library')
  return {
    recipeId: parsedRecipeId,
    isFavorite: parsedFavorite,
  }
}

export async function setRating(recipeId: string, rating: number) {
  const parsedRecipeId = recipeIdSchema.parse(recipeId)
  const parsedRating = ratingSchema.parse(rating)
  const data = await updateRecipeRating(parsedRecipeId, parsedRating === 0 ? null : parsedRating)

  if (!data) {
    throw new Error('Recipe not found')
  }

  revalidatePath('/library')
  return {
    recipeId: parsedRecipeId,
    rating: parsedRating === 0 ? null : parsedRating,
  }
}

export async function editRecipe(recipeId: string, input: z.infer<typeof editRecipeSchema>) {
  const parsedRecipeId = recipeIdSchema.parse(recipeId)
  const parsedInput = editRecipeSchema.parse(input)
  const normalizedInput: Parameters<typeof updateRecipe>[1] = {}

  if (parsedInput.title !== undefined) {
    normalizedInput.title = parsedInput.title.trim()
  }

  if (parsedInput.ingredients !== undefined) {
    const ingredients = parsedInput.ingredients
      .map((item) => item.trim())
      .filter((item) => item.length > 0)

    if (ingredients.length === 0) {
      throw new Error('At least one ingredient is required')
    }

    normalizedInput.ingredients = ingredients
  }

  if (parsedInput.instructions !== undefined) {
    normalizedInput.instructions = parsedInput.instructions.trim()
  }

  if (parsedInput.prep_time !== undefined) {
    normalizedInput.prep_time = parsedInput.prep_time ?? 0
  }

  if (parsedInput.cook_time !== undefined) {
    normalizedInput.cook_time = parsedInput.cook_time ?? 0
  }

  if (parsedInput.servings !== undefined) {
    normalizedInput.servings = parsedInput.servings ?? 1
  }

  if (parsedInput.category !== undefined) {
    normalizedInput.category = parsedInput.category
  }

  if (parsedInput.difficulty !== undefined) {
    normalizedInput.difficulty = parsedInput.difficulty
  }

  if (parsedInput.tags !== undefined) {
    normalizedInput.tags = parsedInput.tags
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0)
      .filter((tag, index, arr) => arr.indexOf(tag) === index)
  }

  const data = await updateRecipe(parsedRecipeId, normalizedInput)

  revalidatePath('/library')
  return data
}

export async function setRecipeImage(recipeId: string, imageUrl: string) {
  const parsedRecipeId = recipeIdSchema.parse(recipeId)
  const parsedImageUrl = z.string().trim().min(1).parse(imageUrl)
  const data = await updateRecipeImage(parsedRecipeId, parsedImageUrl)

  revalidatePath('/library')
  return data
}

export async function deleteRecipeAction(recipeId: string) {
  const parsedRecipeId = recipeIdSchema.parse(recipeId)
  await deleteRecipe(parsedRecipeId)

  revalidatePath('/library')
  return {
    recipeId: parsedRecipeId,
  }
}

export async function restoreRecipe(input: z.infer<typeof restoreRecipeSchema>) {
  const parsedInput = restoreRecipeSchema.parse(input)

  let restored: Awaited<ReturnType<typeof updateRecipe>>

  try {
    restored = await updateRecipe(parsedInput.id, {
      title: parsedInput.title,
      ingredients: parsedInput.ingredients,
      instructions: parsedInput.instructions,
      prep_time: parsedInput.prep_time,
      cook_time: parsedInput.cook_time,
      servings: parsedInput.servings,
      category: parsedInput.category,
      difficulty: parsedInput.difficulty,
      source_url: parsedInput.source_url,
      source_type: parsedInput.source_type,
      tags: parsedInput.tags,
    })
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'Recipe not found') {
      throw error
    }

    restored = await createRecipe({
      title: parsedInput.title,
      ingredients: parsedInput.ingredients,
      instructions: parsedInput.instructions,
      prep_time: parsedInput.prep_time,
      cook_time: parsedInput.cook_time,
      servings: parsedInput.servings,
      category: parsedInput.category,
      difficulty: parsedInput.difficulty,
      image_url: parsedInput.image_url,
      source_url: parsedInput.source_url,
      source_type: parsedInput.source_type,
      tags: parsedInput.tags,
    })
  }

  if (parsedInput.image_url && restored.image_url !== parsedInput.image_url) {
    restored = await updateRecipeImage(restored.id, parsedInput.image_url)
  }

  if (parsedInput.is_favorite) {
    const favoriteUpdated = await updateRecipeFavorite(restored.id, true)
    if (favoriteUpdated) {
      restored = favoriteUpdated
    }
  }

  if (parsedInput.rating !== null) {
    const ratingUpdated = await updateRecipeRating(restored.id, parsedInput.rating)
    if (ratingUpdated) {
      restored = ratingUpdated
    }
  }

  revalidatePath('/library')
  return restored
}
