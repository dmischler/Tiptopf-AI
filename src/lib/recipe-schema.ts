import { z } from 'zod'

import { CATEGORIES, DIFFICULTIES } from '@/lib/recipe-meta'
import { CANONICAL_RECIPE_IMAGE_URL_RE } from '@/lib/recipe-image'

export const categorySchema = z.enum(CATEGORIES)
export const difficultySchema = z.enum(DIFFICULTIES)
export const recipeIdSchema = z.string().uuid()
export const recipeSourceTypeSchema = z.enum(['image', 'url', 'manual'])

export const canonicalRecipeImageUrlSchema = z.string().regex(CANONICAL_RECIPE_IMAGE_URL_RE)

export const storedRecipeImageUrlSchema = z.union([z.null(), canonicalRecipeImageUrlSchema])
