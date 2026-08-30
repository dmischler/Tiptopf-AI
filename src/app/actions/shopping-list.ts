'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertAccess } from '@/lib/access-pin'

import {
  addManualShoppingItem,
  addToShoppingList,
  clearShoppingList,
  removeShoppingListItem,
  toggleShoppingListItem,
} from '@/lib/local/store'

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
) {
  await assertAccess()
  const parsed = addFromRecipeSchema.parse(input)

  await addToShoppingList(
    parsed.items.map((text) => ({
      text,
      sourceRecipeTitle: parsed.sourceRecipeTitle,
      sourceServings: parsed.sourceServings,
    })),
  )

  revalidatePath('/einkaufsliste')
  return { success: true }
}

export async function toggleShoppingListItemAction(itemId: string, checked: boolean) {
  await assertAccess()
  const parsedId = uuidSchema.parse(itemId)
  const parsedChecked = booleanSchema.parse(checked)

  await toggleShoppingListItem(parsedId, parsedChecked)
  revalidatePath('/einkaufsliste')
}

export async function addManualItemAction(text: string) {
  await assertAccess()
  const parsed = textSchema.parse(text)
  await addManualShoppingItem(parsed)
  revalidatePath('/einkaufsliste')
}

export async function clearShoppingListAction() {
  await assertAccess()
  await clearShoppingList()
  revalidatePath('/einkaufsliste')
}

export async function removeShoppingListItemAction(itemId: string) {
  await assertAccess()
  const parsedId = uuidSchema.parse(itemId)
  await removeShoppingListItem(parsedId)
  revalidatePath('/einkaufsliste')
}
