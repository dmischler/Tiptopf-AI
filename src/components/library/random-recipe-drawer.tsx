'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toRecipeImageSrc } from '@/lib/recipe-image'
import type { Recipe } from '@/types'

const REPETITIONS = 5
const ITEM_WIDTH = 160

interface RandomRecipeDrawerProps {
  isOpen: boolean
  onClose: () => void
  recipes: Recipe[]
  onRecipeSelected: (recipe: Recipe) => void
  drawKey: number
}

export function RandomRecipeDrawer({
  isOpen,
  onClose,
  recipes,
  onRecipeSelected,
  drawKey,
}: RandomRecipeDrawerProps) {
  const [phase, setPhase] = useState<'idle' | 'scrolling' | 'popping' | 'done'>('idle')
  const [targetPhysicalIndex, setTargetPhysicalIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const onRecipeSelectedRef = useRef(onRecipeSelected)
  const onCloseRef = useRef(onClose)
  const [stripStyle, setStripStyle] = useState<{ transform: string, transition: string }>({
    transform: 'translateX(0px)',
    transition: 'none'
  })

  useEffect(() => {
    onRecipeSelectedRef.current = onRecipeSelected
    onCloseRef.current = onClose
  })

  const items = useMemo(() => {
    if (recipes.length === 0) return []
    return Array.from({ length: REPETITIONS }).flatMap(() => recipes)
  }, [recipes])

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle')
      setTargetPhysicalIndex(-1)
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      setStripStyle({ transform: 'translateX(0px)', transition: 'none' })
      return
    }

    if (recipes.length === 0) return

    const targetRecipeIndex = Math.floor(Math.random() * recipes.length)
    const recipe = recipes[targetRecipeIndex]
    const middleRepetition = Math.floor(REPETITIONS / 2)
    const physicalIndex = middleRepetition * recipes.length + targetRecipeIndex

    setTargetPhysicalIndex(physicalIndex)
    setStripStyle({ transform: 'translateX(0px)', transition: 'none' })

    // Wait a tick so the dialog DOM is fully laid out, then measure and animate
    const startTimer = setTimeout(() => {
      const container = containerRef.current
      const strip = stripRef.current
      if (!container || !strip) return

      const containerWidth = container.getBoundingClientRect().width
      if (containerWidth === 0) return

      const targetEl = strip.children[physicalIndex] as HTMLElement | undefined
      if (!targetEl) return

      const containerRect = container.getBoundingClientRect()
      const targetRect = targetEl.getBoundingClientRect()
      const targetCenter = targetRect.left + targetRect.width / 2 - containerRect.left
      const containerCenter = containerRect.width / 2
      const finalX = containerCenter - targetCenter

      setPhase('scrolling')

      setStripStyle({
        transform: `translateX(${finalX}px)`,
        transition: 'transform 5s cubic-bezier(0.1, 0.6, 0.2, 1)'
      })

      const popTimer = setTimeout(() => {
        setPhase('popping')
      }, 5000)

      const doneTimer = setTimeout(() => {
        setPhase('done')
        onRecipeSelectedRef.current(recipe)
        onCloseRef.current()
      }, 5800)

      timersRef.current = [popTimer, doneTimer]
    }, 50)

    timersRef.current.push(startTimer)

    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [isOpen, recipes, drawKey])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      onClose()
    }
  }

  const exactTargetIndex = targetPhysicalIndex

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-full max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton={phase !== 'scrolling' && phase !== 'popping'}
      >
        <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12">
          <DialogTitle>Zufallsrezept wird gezogen...</DialogTitle>
          <DialogDescription>
            Dein Glücksrezept aus der aktuellen Auswahl.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={containerRef}
          className="relative flex items-center justify-start overflow-hidden bg-muted/30 py-10"
          style={{ height: 240 }}
        >
          {recipes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Rezepte vorhanden.
            </p>
          ) : (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-primary/40" />
              <div
                ref={stripRef}
                className="flex items-center gap-4 will-change-transform"
                style={stripStyle}
              >
                {items.map((recipe, index) => {
                  const isExactTarget = index === exactTargetIndex
                  const isPopping = phase === 'popping' || phase === 'done'
                  const imageSrc = toRecipeImageSrc(recipe)

                  return (
                    <div
                      key={`${recipe.id}-${index}`}
                      className={[
                        'relative flex-shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-300',
                        isExactTarget && isPopping
                          ? 'z-20 scale-[1.15] border-primary shadow-[0_0_24px_rgba(234,179,8,0.4)]'
                          : 'z-0 scale-100 border-transparent',
                      ].join(' ')}
                      style={{ width: ITEM_WIDTH, height: ITEM_WIDTH }}
                    >
                      {imageSrc ? (
                        <Image
                          src={imageSrc}
                          alt={recipe.title}
                          fill
                          className="object-cover"
                          sizes="160px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted p-2 text-center">
                          <span className="line-clamp-3 text-xs text-muted-foreground">
                            {recipe.title}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
