import { z } from 'zod'

import { CANONICAL_RECIPE_IMAGE_URL_RE } from '@/lib/recipe-image'

export const canonicalRecipeImageUrlSchema = z.string().regex(CANONICAL_RECIPE_IMAGE_URL_RE)

export const storedRecipeImageUrlSchema = z.union([z.null(), canonicalRecipeImageUrlSchema])
