'use client'

import { Plus } from 'lucide-react'

type FloatingAddButtonProps = {
  onClick: () => void
}

export function FloatingAddButton({ onClick }: FloatingAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/20 transition hover:scale-[1.02] hover:shadow-xl active:scale-95 active:shadow-xl sm:flex"
      aria-label="Add recipe"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingRight: 'env(safe-area-inset-right)' }}
    >
      <Plus className="h-6 w-6" />
    </button>
  )
}
