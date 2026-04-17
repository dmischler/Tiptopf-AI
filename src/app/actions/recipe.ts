'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const recipeIdSchema = z.string().uuid()
const favoriteSchema = z.boolean()
const ratingSchema = z.number().int().min(0).max(5)

async function getAuthenticatedContext() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  return { supabase, user }
}

export async function toggleFavorite(recipeId: string, isFavorite: boolean) {
  const parsedRecipeId = recipeIdSchema.parse(recipeId)
  const parsedFavorite = favoriteSchema.parse(isFavorite)
  const { supabase, user } = await getAuthenticatedContext()

  const { data, error } = await supabase
    .from('recipes')
    .update({ is_favorite: parsedFavorite })
    .eq('id', parsedRecipeId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

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
  const { supabase, user } = await getAuthenticatedContext()

  const { data, error } = await supabase
    .from('recipes')
    .update({ rating: parsedRating === 0 ? null : parsedRating })
    .eq('id', parsedRecipeId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('Recipe not found')
  }

  revalidatePath('/library')
  return {
    recipeId: parsedRecipeId,
    rating: parsedRating === 0 ? null : parsedRating,
  }
}
