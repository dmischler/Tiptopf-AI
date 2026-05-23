import type { ShoppingListItem } from '@/types'

export function reorderShoppingList(list: ShoppingListItem[]): ShoppingListItem[] {
  const unchecked = list.filter((item) => !item.checked)
  const checked = list.filter((item) => item.checked)
  return [...unchecked, ...checked]
}
