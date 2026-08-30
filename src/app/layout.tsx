import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'

import { BottomNav } from '@/components/layout/bottom-nav'
import { TopNav } from '@/components/layout/top-nav'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Tiptopf',
  description: 'Foto aufnehmen oder URL einfügen. Die KI strukturiert deine Rezepte in eine durchsuchbare Bibliothek.',
  applicationName: 'Tiptopf',
  appleWebApp: {
    capable: true,
    title: 'Tiptopf',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f0f0f',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className={cn('dark font-sans', geist.variable)}>
      <body className="min-h-screen bg-background pt-[env(safe-area-inset-top)] text-foreground antialiased">
        <a
          href="#app-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Zum Inhalt
        </a>
        <TopNav />
        <div id="app-content">{children}</div>
        <BottomNav />
        <div data-print-hide>
          <Toaster position="top-center" offset={{ top: 'max(0.75rem, env(safe-area-inset-top))' }} richColors />
        </div>
      </body>
    </html>
  )
}
