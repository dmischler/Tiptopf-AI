'use server'

import { z } from 'zod'

import { revalidateApp } from '@/app/actions/_revalidate'
import { assertAccess } from '@/lib/access-pin'

import {
  addManualShoppingItem,
  addToShoppingList,
  clearShoppingList,
  removeShoppingListItem,
  toggleShoppingListItem,
} from '@/lib/local/store'
import type { ShoppingListItem } from '@/types'

const textSchema = z.string().trim().min(1)
const uuidSchema = z.string().uuid()
const booleanSchema = z.boolean()
const positiveIntSchema = z.number().int().min(1)

const addFromRecipeSchema = z.object({
  items: z.array(z.string().trim().min(1)).min(1),
  sourceRecipeTitle: z.string().trim().min(1).optional(),
  sourceServings: positiveIntSchema.optional(),
})

export async function addRecipeIngredientsToShoppingList(
  input: z.infer<typeof addFromRecipeSchema>,
): Promise<ShoppingListItem[]> {
  await assertAccess()
  const parsed = addFromRecipeSchema.parse(input)

  const list = await addToShoppingList(
    parsed.items.map((text) => ({
      text,
      sourceRecipeTitle: parsed.sourceRecipeTitle,
      sourceServings: parsed.sourceServings,
    })),
  )

  revalidateApp()
  return list
}

export async function toggleShoppingListItemAction(
  itemId: string,
  checked: boolean,
): Promise<ShoppingListItem[]> {
  await assertAccess()
  const parsedId = uuidSchema.parse(itemId)
  const parsedChecked = booleanSchema.parse(checked)

  const list = await toggleShoppingListItem(parsedId, parsedChecked)
  revalidateApp()
  return list
}

export async function addManualItemAction(text: string): Promise<ShoppingListItem[]> {
  await assertAccess()
  const parsed = textSchema.parse(text)
  const list = await addManualShoppingItem(parsed)
  revalidateApp()
  return list
}

export async function clearShoppingListAction(): Promise<ShoppingListItem[]> {
  await assertAccess()
  const list = await clearShoppingList()
  revalidateApp()
  return list
}

export async function removeShoppingListItemAction(itemId: string): Promise<ShoppingListItem[]> {
  await assertAccess()
  const parsedId = uuidSchema.parse(itemId)
  const list = await removeShoppingListItem(parsedId)
  revalidateApp()
  return list
}
