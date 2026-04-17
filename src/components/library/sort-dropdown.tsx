'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SortOption } from '@/types'

type SortDropdownProps = {
  value: SortOption
  onChange: (value: SortOption) => void
}

const LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  prep_time: 'Prep time',
  rating: 'Highest rating',
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as SortOption)}>
      <SelectTrigger className="h-9 w-full sm:w-44">
        <SelectValue>{LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="newest">Newest</SelectItem>
        <SelectItem value="oldest">Oldest</SelectItem>
        <SelectItem value="prep_time">Prep time (shortest)</SelectItem>
        <SelectItem value="rating">Rating (highest)</SelectItem>
      </SelectContent>
    </Select>
  )
}
