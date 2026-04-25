'use client'

import { Check, SlidersHorizontal } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { LibraryCategoryFilter } from '@/types'

export type CategoryFilterValue = {
  category: LibraryCategoryFilter
  favoritesOnly: boolean
}

type CategoryFilterProps = {
  value: CategoryFilterValue
  onChange: (value: CategoryFilterValue) => void
}

const CATEGORY_ITEMS: Array<{ value: LibraryCategoryFilter; label: string }> = [
  { value: 'all', label: 'Alle Kategorien' },
  { value: 'starter', label: 'Vorspeise' },
  { value: 'main', label: 'Hauptgericht' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'side', label: 'Beilage' },
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'snack', label: 'Snack' },
]

export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  const activeCategoryLabel = CATEGORY_ITEMS.find((item) => item.value === value.category)?.label ?? 'Alle Kategorien'

  const buttonLabel = value.favoritesOnly
    ? `${activeCategoryLabel} · Favoriten`
    : activeCategoryLabel

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton={false}
        render={
          <div
            className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-52"
          />
        }
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="truncate">{buttonLabel}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Kategorie</DropdownMenuLabel>
          {CATEGORY_ITEMS.map((item) => (
          <DropdownMenuItem
            key={item.value}
            closeOnClick={false}
            onClick={() => onChange({ ...value, category: item.value })}
            className="justify-between"
          >
            {item.label}
            {value.category === item.value ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          closeOnClick={false}
          checked={value.favoritesOnly}
          onCheckedChange={(checked) => onChange({ ...value, favoritesOnly: checked })}
        >
          Nur Favoriten
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
