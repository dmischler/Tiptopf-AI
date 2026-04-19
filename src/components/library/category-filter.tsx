'use client'

import { Check, SlidersHorizontal } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
  { value: 'all', label: 'All categories' },
  { value: 'starter', label: 'Starter' },
  { value: 'main', label: 'Main' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'side', label: 'Side' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'snack', label: 'Snack' },
]

export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  const activeCategoryLabel = CATEGORY_ITEMS.find((item) => item.value === value.category)?.label ?? 'All categories'

  const buttonLabel = value.favoritesOnly
    ? `${activeCategoryLabel} · Favorites`
    : activeCategoryLabel

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton={false}
        render={
          <div
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-52"
          />
        }
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="truncate">{buttonLabel}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Category</DropdownMenuLabel>
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
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          closeOnClick={false}
          checked={value.favoritesOnly}
          onCheckedChange={(checked) => onChange({ ...value, favoritesOnly: checked })}
        >
          Favorites only
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
