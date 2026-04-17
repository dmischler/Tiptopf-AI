'use client'

import type { ReactNode } from 'react'

type MasonryGridProps = {
  children: ReactNode
}

type MasonryItemProps = {
  children: ReactNode
}

export function MasonryGrid({ children }: MasonryGridProps) {
  return <div className="columns-1 gap-4 space-y-4 sm:columns-2 md:columns-3 lg:columns-4">{children}</div>
}

export function MasonryItem({ children }: MasonryItemProps) {
  return <div className="break-inside-avoid">{children}</div>
}
