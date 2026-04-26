'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { APP_NAV_ITEMS } from '@/components/layout/nav-items'
import { cn } from '@/lib/utils'

export function TopNav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-40 hidden border-b border-border bg-background/95 backdrop-blur-sm md:block">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/library" className="text-sm font-semibold tracking-wide text-foreground">
          Tiptopf-AI
        </Link>

        <div className="flex items-center gap-1">
          {APP_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
