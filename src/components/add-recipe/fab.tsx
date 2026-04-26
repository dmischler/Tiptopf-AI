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
      className="fixed bottom-20 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/20 transition hover:scale-[1.02] hover:shadow-xl active:scale-95 active:shadow-xl md:bottom-6"
      aria-label="Add recipe"
    >
      <Plus className="h-6 w-6" />
    </button>
  )
}
