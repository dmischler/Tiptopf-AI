'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { updateRecipeFavorite, updateRecipeRating } from '@/lib/local/store'

const recipeIdSchema = z.string().uuid()
const favoriteSchema = z.boolean()
const ratingSchema = z.number().int().min(0).max(5)

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
