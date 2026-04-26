'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  addRecipeToCollection,
  createCollection,
  deleteCollection,
  listCollections,
  removeRecipeFromCollection,
  updateCollection,
} from '@/lib/local/store'

const collectionNameSchema = z.string().trim().min(1).max(100)

export async function listCollectionsAction() {
  const collections = await listCollections()
  return collections
}

export async function createCollectionAction(name: string) {
  const parsedName = collectionNameSchema.parse(name)
  const collection = await createCollection(parsedName)
  revalidatePath('/collections')
  return collection
}

export async function updateCollectionAction(collectionId: string, name: string) {
  const parsedId = z.string().uuid().parse(collectionId)
  const parsedName = collectionNameSchema.parse(name)
  const collection = await updateCollection(parsedId, parsedName)
  revalidatePath('/collections')
  return collection
}

export async function deleteCollectionAction(collectionId: string) {
  const parsedId = z.string().uuid().parse(collectionId)
  await deleteCollection(parsedId)
  revalidatePath('/collections')
  return { collectionId: parsedId }
}

export async function addRecipeToCollectionAction(collectionId: string, recipeId: string) {
  const parsedCollectionId = z.string().uuid().parse(collectionId)
  const parsedRecipeId = z.string().uuid().parse(recipeId)
  const collection = await addRecipeToCollection(parsedCollectionId, parsedRecipeId)
  revalidatePath('/collections')
  return collection
}

export async function removeRecipeFromCollectionAction(collectionId: string, recipeId: string) {
  const parsedCollectionId = z.string().uuid().parse(collectionId)
  const parsedRecipeId = z.string().uuid().parse(recipeId)
  const collection = await removeRecipeFromCollection(parsedCollectionId, parsedRecipeId)
  revalidatePath('/collections')
  return collection
}
