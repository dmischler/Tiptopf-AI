import { describe, expect, it } from 'vitest'

import { reorderShoppingList } from '@/lib/shopping'
import type { ShoppingListItem } from '@/types'

function item(id: string, checked: boolean): ShoppingListItem {
  return {
    id,
    text: id,
    checked,
    addedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('reorderShoppingList', () => {
  it('keeps unchecked items above checked items and preserves relative order', () => {
    const input = [item('a', true), item('b', false), item('c', true), item('d', false)]

    expect(reorderShoppingList(input).map((entry) => entry.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('returns an empty list unchanged', () => {
    expect(reorderShoppingList([])).toEqual([])
  })
})
