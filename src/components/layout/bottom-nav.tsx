'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { APP_NAV_ITEMS } from '@/components/layout/nav-items'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()

  // Visible below md, and on short landscape even if width ≥ 768.
  // Hidden only with `nav-top`: min-width 768px AND min-height 600px.
  // See globals.css @custom-variant nav-top and top-nav.tsx.
  return (
    <nav
      data-print-hide
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-sm nav-top:hidden"
    >
      <div className="flex items-center justify-around">
        {APP_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          const isShopping = item.href === '/einkaufsliste'

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={isShopping ? 'Einkaufsliste' : item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-11 min-w-11 flex-col items-center gap-0.5 px-4 py-2 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{isShopping ? 'Einkauf' : item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
