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
  newest: 'Neueste',
  oldest: 'Älteste',
  prep_time: 'Zubereitungszeit',
  rating: 'Höchste Bewertung',
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as SortOption)}>
      <SelectTrigger className="w-full sm:w-44">
        <SelectValue>
          {(val) => (val ? LABELS[val as SortOption] : LABELS.newest)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="newest">Neueste</SelectItem>
        <SelectItem value="oldest">Älteste</SelectItem>
        <SelectItem value="prep_time">Zubereitungszeit</SelectItem>
        <SelectItem value="rating">Höchste Bewertung</SelectItem>
      </SelectContent>
    </Select>
  )
}
