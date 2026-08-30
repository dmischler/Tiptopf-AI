'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  threshold?: number
  resistance?: number
}

const DEFAULT_THRESHOLD = 80
const DEFAULT_RESISTANCE = 2.2
const INDICATOR_HEIGHT = 60
const TOP_GAP = 4 // small visual breathing room

function hasOpenDialog() {
  return Boolean(
    document.querySelector('[data-slot="dialog-overlay"][data-open], [data-slot="dialog-content"][data-open]')
  )
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = DEFAULT_THRESHOLD,
  resistance = DEFAULT_RESISTANCE,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const touchStartYRef = useRef(0)
  const currentPullRef = useRef(0)
  const isDraggingRef = useRef(false)
  const indicatorRef = useRef<HTMLDivElement>(null)

  // PTR follows the same chrome as bottom nav: coarse pointer, and not nav-top.
  useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse) and ((max-width: 767px) or (max-height: 599px))')
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing || !isMobile || hasOpenDialog()) return

      const scrollTop = window.scrollY || document.documentElement.scrollTop
      if (scrollTop > 8) return

      isDraggingRef.current = true
      touchStartYRef.current = e.touches[0].clientY
      currentPullRef.current = 0
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || isRefreshing || !isMobile || hasOpenDialog()) return

      const scrollTop = window.scrollY || document.documentElement.scrollTop
      if (scrollTop > 8) {
        // User started scrolling the content — abort pull gesture
        isDraggingRef.current = false
        setPullDistance(0)
        currentPullRef.current = 0
        return
      }

      const currentY = e.touches[0].clientY
      const delta = currentY - touchStartYRef.current

      if (delta <= 0) return

      // Apply resistance so the gesture feels natural (not 1:1)
      const resisted = Math.min(delta / resistance, 140)
      currentPullRef.current = resisted

      // Update visual state
      setPullDistance(resisted)

      // Prevent the page from scrolling while we are pulling the refresh indicator
      e.preventDefault()
    }

    const finishGesture = async () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false

      const pulled = currentPullRef.current
      currentPullRef.current = 0

      if (pulled > threshold && !isRefreshing) {
        setIsRefreshing(true)
        setPullDistance(INDICATOR_HEIGHT + TOP_GAP)

        try {
          await onRefresh()
        } catch {
          // onRefresh already surfaced the error via toast
        } finally {
          // Collapse with a short transition
          setIsRefreshing(false)
          setPullDistance(0)
        }
      } else {
        // Not enough pull — spring back
        setPullDistance(0)
      }
    }

    const handleTouchEnd = () => {
      void finishGesture()
    }

    const handleTouchCancel = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        currentPullRef.current = 0
        setPullDistance(0)
      }
    }

    // Attach at document level so we catch pulls anywhere on the dashboard
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [isMobile, isRefreshing, onRefresh, resistance, threshold])

  const progress = Math.min(pullDistance / threshold, 1)
  const isPastThreshold = pullDistance > threshold

  const indicatorTranslate = isRefreshing
    ? 0
    : Math.max(0, pullDistance - INDICATOR_HEIGHT)

  const contentTranslate = isRefreshing
    ? INDICATOR_HEIGHT + TOP_GAP
    : pullDistance

  const showIndicator = pullDistance > 2 || isRefreshing

  return (
    <>
      {/* Pull indicator - only visible on mobile, slides in from above */}
      {showIndicator && (
        <div
          ref={indicatorRef}
          className={cn(
            'fixed left-0 right-0 z-[65] flex items-center justify-center md:hidden',
            'bg-background/95 text-sm text-muted-foreground backdrop-blur-sm',
            'border-b border-border/60'
          )}
          style={{
            top: 'env(safe-area-inset-top)',
            height: `${INDICATOR_HEIGHT}px`,
            transform: `translateY(${indicatorTranslate}px)`,
            transition: isDraggingRef.current ? 'none' : 'transform 180ms cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          <div className="flex items-center gap-2">
            {isRefreshing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Aktualisiere…</span>
              </>
            ) : (
              <>
                <ArrowDown
                  className="h-4 w-4 transition-transform duration-150"
                  style={{ transform: `rotate(${progress * 180}deg)` }}
                />
                <span>{isPastThreshold ? 'Loslassen zum Aktualisieren' : 'Zum Aktualisieren herunterziehen'}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Content wrapper that gets pushed down to reveal the indicator */}
      <div
        style={{
          transform: showIndicator ? `translateY(${contentTranslate}px)` : 'none',
          transition: isDraggingRef.current ? 'none' : 'transform 180ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {children}
      </div>
    </>
  )
}
