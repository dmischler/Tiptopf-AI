'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
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
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/library')
  return data
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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const ext = file.type.split('/')[1] || 'jpg'
  const filePath = `${user.id}/${recipeId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('recipe-images')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: publicData } = supabase.storage.from('recipe-images').getPublicUrl(filePath)
  const imageUrl = publicData.publicUrl

  const { error: updateError } = await supabase
    .from('recipes')
    .update({ image_url: imageUrl })
    .eq('id', recipeId)
    .eq('user_id', user.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  revalidatePath('/library')
  return imageUrl
}
