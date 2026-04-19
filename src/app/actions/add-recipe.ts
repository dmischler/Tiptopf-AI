'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { saveUploadedRecipeImage } from '@/lib/local/images'
import { createRecipe, updateRecipeImage } from '@/lib/local/store'

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
  imageUrl: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  sourceType: z.enum(['image', 'url']),
})

export async function saveRecipe(input: z.infer<typeof saveRecipeSchema>) {
  const parsed = saveRecipeSchema.parse(input)
  const recipe = await createRecipe({
    title: parsed.title,
    ingredients: parsed.ingredients,
    instructions: parsed.instructions,
    prep_time: parsed.prepTime ?? 0,
    cook_time: parsed.cookTime ?? 0,
    servings: parsed.servings ?? 1,
    category: parsed.category,
    difficulty: parsed.difficulty,
    image_url: parsed.imageUrl,
    source_url: parsed.sourceUrl,
    source_type: parsed.sourceType,
  })

  revalidatePath('/library')
  return recipe
}

const ALLOWED_REPLACE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_REPLACE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

export async function uploadRecipeImage(formData: FormData): Promise<string> {
  const recipeId = formData.get('recipeId')
  const file = formData.get('image')

  if (typeof recipeId !== 'string' || !recipeId) {
    throw new Error('Invalid recipe id')
  }

  if (!(file instanceof File)) {
    throw new Error('Image file is required')
  }

  if (!ALLOWED_REPLACE_IMAGE_TYPES.has(file.type)) {
    throw new Error('Only JPG, PNG, and WEBP images are supported')
  }

  if (file.size > MAX_REPLACE_IMAGE_SIZE_BYTES) {
    throw new Error('Image must be 5MB or smaller')
  }

  const imageUrl = await saveUploadedRecipeImage(file, recipeId)
  await updateRecipeImage(recipeId, imageUrl)

  revalidatePath('/library')
  return imageUrl
}
