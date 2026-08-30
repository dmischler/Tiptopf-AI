'use server'

import { z } from 'zod'

import { revalidateApp } from '@/app/actions/_revalidate'
import { assertAccess } from '@/lib/access-pin'
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
  await assertAccess()
  const collections = await listCollections()
  return collections
}

export async function createCollectionAction(name: string) {
  await assertAccess()
  const parsedName = collectionNameSchema.parse(name)
  const collection = await createCollection(parsedName)
  revalidateApp()
  return collection
}

export async function updateCollectionAction(collectionId: string, name: string) {
  await assertAccess()
  const parsedId = z.string().uuid().parse(collectionId)
  const parsedName = collectionNameSchema.parse(name)
  const collection = await updateCollection(parsedId, parsedName)
  revalidateApp()
  return collection
}

export async function deleteCollectionAction(collectionId: string) {
  await assertAccess()

  const parsedId = z.string().uuid().parse(collectionId)
  await deleteCollection(parsedId)
  revalidateApp()
  return { collectionId: parsedId }
}

export async function addRecipeToCollectionAction(collectionId: string, recipeId: string) {
  await assertAccess()
  const parsedCollectionId = z.string().uuid().parse(collectionId)
  const parsedRecipeId = z.string().uuid().parse(recipeId)
  const collection = await addRecipeToCollection(parsedCollectionId, parsedRecipeId)
  revalidateApp()
  return collection
}

export async function removeRecipeFromCollectionAction(collectionId: string, recipeId: string) {
  await assertAccess()
  const parsedCollectionId = z.string().uuid().parse(collectionId)
  const parsedRecipeId = z.string().uuid().parse(recipeId)
  const collection = await removeRecipeFromCollection(parsedCollectionId, parsedRecipeId)
  revalidateApp()
  return collection
}
