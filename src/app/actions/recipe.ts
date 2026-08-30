'use server'

import { z } from 'zod'

import { revalidateApp } from '@/app/actions/_revalidate'
import { assertAccess } from '@/lib/access-pin'
import { purgeTrashedRecipeImage, restoreTrashedRecipeImage } from '@/lib/local/images'
import {
  deleteRecipe,
  listRecipes,
  LOCAL_PROFILE_ID,
  patchRecipe,
  updateRecipe,
  updateRecipeFavorite,
  updateRecipeRating,
  upsertRecipe,
} from '@/lib/local/store'
import { canonicalRecipeImageUrl, parseApiImageFileName } from '@/lib/recipe-image'
import {
  categorySchema,
  difficultySchema,
  recipeIdSchema,
  recipeSourceTypeSchema,
  storedRecipeImageUrlSchema,
} from '@/lib/recipe-schema'
import { normalizeTags } from '@/lib/utils'
import type { Recipe } from '@/types'

const favoriteSchema = z.boolean()
const ratingSchema = z.number().int().min(0).max(5)

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
  notes: z.string().max(2000).optional(),
})

const restoreRecipeSchema = z.object({
  id: recipeIdSchema,
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
  source_type: recipeSourceTypeSchema,
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export async function toggleFavorite(recipeId: string, isFavorite: boolean) {
  await assertAccess()
  const parsedRecipeId = recipeIdSchema.parse(recipeId)
  const parsedFavorite = favoriteSchema.parse(isFavorite)
  const data = await updateRecipeFavorite(parsedRecipeId, parsedFavorite)

  if (!data) {
    throw new Error('Recipe not found')
  }

  revalidateApp()
  return {
    recipeId: parsedRecipeId,
    isFavorite: parsedFavorite,
  }
}

export async function setRating(recipeId: string, rating: number) {
  await assertAccess()
  const parsedRecipeId = recipeIdSchema.parse(recipeId)
  const parsedRating = ratingSchema.parse(rating)
  const data = await updateRecipeRating(parsedRecipeId, parsedRating === 0 ? null : parsedRating)

  if (!data) {
    throw new Error('Recipe not found')
  }

  revalidateApp()
  return {
    recipeId: parsedRecipeId,
    rating: parsedRating === 0 ? null : parsedRating,
  }
}

export async function editRecipe(recipeId: string, input: z.infer<typeof editRecipeSchema>) {
  await assertAccess()
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
    normalizedInput.tags = normalizeTags(parsedInput.tags)
  }

  if (parsedInput.notes !== undefined) {
    normalizedInput.notes = parsedInput.notes.trim()
  }

  const data = await updateRecipe(parsedRecipeId, normalizedInput)

  revalidateApp()
  return data
}

export async function setRecipeImage(recipeId: string, imageUrl: string | null) {
  await assertAccess()
  const parsedRecipeId = recipeIdSchema.parse(recipeId)
  const parsedImageUrl = storedRecipeImageUrlSchema.parse(imageUrl)
  const data = await patchRecipe(parsedRecipeId, { image_url: parsedImageUrl })

  revalidateApp()
  return data
}

export async function deleteRecipeAction(recipeId: string) {
  await assertAccess()
  const parsedRecipeId = recipeIdSchema.parse(recipeId)
  await deleteRecipe(parsedRecipeId)

  revalidateApp()
  return {
    recipeId: parsedRecipeId,
  }
}

export async function purgeTrashedRecipeImageAction(recipeId: string) {
  await assertAccess()
  const parsedRecipeId = recipeIdSchema.parse(recipeId)
  await purgeTrashedRecipeImage(parsedRecipeId)
  return { recipeId: parsedRecipeId }
}

export async function restoreRecipe(input: z.infer<typeof restoreRecipeSchema>) {
  await assertAccess()
  const parsedInput = restoreRecipeSchema.parse(input)
  const hadLocalImage = Boolean(parseApiImageFileName(parsedInput.image_url))
  const canonicalUrl = canonicalRecipeImageUrl(parsedInput.id)

  const restored = await upsertRecipe({
    id: parsedInput.id,
    user_id: LOCAL_PROFILE_ID,
    title: parsedInput.title,
    ingredients: parsedInput.ingredients,
    instructions: parsedInput.instructions,
    prep_time: parsedInput.prep_time,
    cook_time: parsedInput.cook_time,
    servings: parsedInput.servings,
    category: parsedInput.category,
    difficulty: parsedInput.difficulty,
    rating: parsedInput.rating,
    is_favorite: parsedInput.is_favorite,
    image_url: hadLocalImage ? canonicalUrl : null,
    source_url: parsedInput.source_url,
    source_type: parsedInput.source_type,
    tags: parsedInput.tags ?? [],
    notes: parsedInput.notes ?? '',
    created_at: parsedInput.created_at ?? new Date().toISOString(),
    updated_at: parsedInput.updated_at ?? new Date().toISOString(),
  } satisfies Recipe)

  try {
    await restoreTrashedRecipeImage(parsedInput.id)
  } catch (error) {
    console.error('Failed to restore recipe image from trash:', error)
  }

  revalidateApp()
  return restored
}

export async function listRecipesAction() {
  await assertAccess()
  const recipes = await listRecipes()
  return recipes
}
