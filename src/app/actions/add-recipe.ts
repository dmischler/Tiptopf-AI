'use server'

import { z } from 'zod'

import { revalidateApp } from '@/app/actions/_revalidate'
import { assertAccess } from '@/lib/access-pin'
import { UnsafeUrlError } from '@/lib/http/safe-fetch'
import { downloadImageToLocalStorage, saveUploadedRecipeImage } from '@/lib/local/images'
import { createRecipe, patchRecipe } from '@/lib/local/store'
import {
  canonicalRecipeImageUrl,
  isCanonicalRecipeImageUrl,
} from '@/lib/recipe-image'
import { storedRecipeImageUrlSchema } from '@/lib/recipe-schema'

const categorySchema = z.enum(['starter', 'main', 'dessert', 'side', 'breakfast', 'snack'])
const difficultySchema = z.enum(['easy', 'medium', 'hard'])

const saveRecipeSchema = z.object({
  title: z.string().min(1),
  ingredients: z.array(z.string()),
  instructions: z.string().min(1),
  prepTime: z.number().int().nullable(),
  cookTime: z.number().int().nullable(),
  servings: z.number().int().nullable(),
  category: categorySchema,
  difficulty: difficultySchema,
  imageUrl: storedRecipeImageUrlSchema.optional(),
  remoteImageUrl: z.string().url().nullable().optional(),
  sourceUrl: z.string().nullable(),
  sourceType: z.enum(['image', 'url', 'manual']),
  tags: z.array(z.string()).optional(),
})

const ALLOWED_REPLACE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_REPLACE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

export async function saveRecipe(
  input: z.infer<typeof saveRecipeSchema>,
  imageFile?: File | null
) {
  await assertAccess()
  const parsed = saveRecipeSchema.parse(input)
  const remoteImageUrl =
    typeof parsed.remoteImageUrl === 'string' && /^https?:\/\//i.test(parsed.remoteImageUrl)
      ? parsed.remoteImageUrl
      : null

  let recipe = await createRecipe({
    title: parsed.title,
    ingredients: parsed.ingredients,
    instructions: parsed.instructions,
    prep_time: parsed.prepTime ?? 0,
    cook_time: parsed.cookTime ?? 0,
    servings: parsed.servings ?? 1,
    category: parsed.category,
    difficulty: parsed.difficulty,
    image_url: null,
    source_url: parsed.sourceUrl,
    source_type: parsed.sourceType,
    tags: parsed.tags,
  })

  const canonicalUrl = canonicalRecipeImageUrl(recipe.id)

  try {
    if (imageFile instanceof File) {
      const imageUrl = await saveUploadedRecipeImage(imageFile, recipe.id)
      recipe = await patchRecipe(recipe.id, { image_url: imageUrl })
    } else if (remoteImageUrl) {
      const imageUrl = await downloadImageToLocalStorage(remoteImageUrl, recipe.id)
      recipe = await patchRecipe(recipe.id, { image_url: imageUrl })
    } else if (parsed.imageUrl && isCanonicalRecipeImageUrl(parsed.imageUrl) && parsed.imageUrl === canonicalUrl) {
      recipe = await patchRecipe(recipe.id, { image_url: canonicalUrl })
    }
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      console.error('Failed to persist recipe image: URL nicht erlaubt')
    } else {
      console.error('Failed to persist recipe image')
    }
  }

  revalidateApp()
  return recipe
}

export async function uploadRecipeImage(formData: FormData): Promise<string> {
  await assertAccess()
  const recipeId = formData.get('recipeId')
  const file = formData.get('image')

  if (typeof recipeId !== 'string' || !z.string().uuid().safeParse(recipeId).success) {
    throw new Error('Ungültige Rezept-ID')
  }

  if (!(file instanceof File)) {
    throw new Error('Bilddatei fehlt')
  }

  if (!ALLOWED_REPLACE_IMAGE_TYPES.has(file.type)) {
    throw new Error('Nur JPG, PNG und WEBP sind erlaubt.')
  }

  if (file.size > MAX_REPLACE_IMAGE_SIZE_BYTES) {
    throw new Error('Bild darf höchstens 5 MB groß sein.')
  }

  const imageUrl = await saveUploadedRecipeImage(file, recipeId)
  await patchRecipe(recipeId, { image_url: imageUrl })

  revalidateApp()
  return imageUrl
}
