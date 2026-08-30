'use client'

import type { ReactNode } from 'react'

type MasonryGridProps = {
  children: ReactNode
}

type MasonryItemProps = {
  children: ReactNode
}

export function MasonryGrid({ children }: MasonryGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {children}
    </div>
  )
}

export function MasonryItem({ children }: MasonryItemProps) {
  return <div className="min-w-0">{children}</div>
}
