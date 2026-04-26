'use client'

import Image from 'next/image'

import { Card, CardContent } from '@/components/ui/card'
import type { Collection } from '@/types'

interface CollectionCardProps {
  collection: Collection
  recipeCount: number
  coverImage?: string | null
  onClick: () => void
}

export function CollectionCard({ collection, recipeCount, coverImage, onClick }: CollectionCardProps) {
  return (
    <Card
      className="cursor-pointer overflow-hidden transition duration-150 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.985] active:shadow-md"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={collection.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/40 text-sm text-muted-foreground">
            Kein Bild
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-base font-semibold text-white">{collection.name}</h3>
          <p className="text-xs text-white/80">
            {recipeCount} Rezept{recipeCount === 1 ? '' : 'e'}
          </p>
        </div>
      </div>
    </Card>
  )
}
