'use client'

import { Dices } from 'lucide-react'

type RandomRecipeFabProps = {
  onClick: () => void
}

export function RandomRecipeFab({ onClick }: RandomRecipeFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed right-6 bottom-36 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-black/20 transition hover:scale-[1.02] hover:shadow-xl active:scale-95 active:shadow-xl md:hidden"
      aria-label="Zufallsrezept ziehen"
    >
      <Dices className="h-6 w-6" />
    </button>
  )
}
