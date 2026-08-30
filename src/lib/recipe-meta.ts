import type { Difficulty, RecipeCategory } from '@/types'

export const CATEGORIES = ['starter', 'main', 'dessert', 'side', 'breakfast', 'snack'] as const
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

export const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  starter: 'Vorspeise',
  main: 'Hauptgericht',
  dessert: 'Dessert',
  side: 'Beilage',
  breakfast: 'Frühstück',
  snack: 'Snack',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Einfach',
  medium: 'Mittel',
  hard: 'Schwer',
}

export const CATEGORY_CLASS: Record<RecipeCategory, string> = {
  starter: 'bg-cyan-500/15 text-cyan-300',
  main: 'bg-amber-500/20 text-amber-300',
  dessert: 'bg-rose-500/15 text-rose-300',
  side: 'bg-emerald-500/15 text-emerald-300',
  breakfast: 'bg-yellow-500/20 text-yellow-300',
  snack: 'bg-orange-500/20 text-orange-300',
}

export const CATEGORY_CHIP_CLASS: Record<RecipeCategory, string> = {
  starter: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  main: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  dessert: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  side: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  breakfast: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  snack: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
}

export function formatTotalTime(prep: number, cook: number): string {
  const total = prep + cook
  return total > 0 ? `${total} min` : 'Keine Zeitangabe'
}
