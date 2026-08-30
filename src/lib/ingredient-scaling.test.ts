import { describe, expect, it } from 'vitest'

import { canScale, scaleIngredient } from '@/lib/ingredient-scaling'

describe('scaleIngredient', () => {
  it.each([
    ['150 g Mehl', 2, 4, '300 g Mehl'],
    ['2 Eier', 2, 4, '4 Eier'],
    ['1 1/2 TL Salz', 2, 4, '3 TL Salz'],
    ['1½ TL Salz', 2, 4, '3 TL Salz'],
    ['2-3 EL Zucker', 2, 4, '4-6 EL Zucker'],
    ['Salz nach Geschmack', 2, 4, 'Salz nach Geschmack'],
    ['Pfeffer', 1, 8, 'Pfeffer'],
  ] as const)('scales %s from %i to %i', (input, from, to, expected) => {
    expect(scaleIngredient(input, to / from)).toBe(expected)
  })

  it('does not treat Eier as a unit token', () => {
    expect(scaleIngredient('2 Eier, bio', 2)).toBe('4 Eier, bio')
    expect(canScale('2 Eier')).toBe(true)
  })
})
