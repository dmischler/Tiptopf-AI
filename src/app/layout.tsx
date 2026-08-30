import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'

import { BottomNav } from '@/components/layout/bottom-nav'
import { TopNav } from '@/components/layout/top-nav'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Tiptopf-AI - Your AI-Powered Recipe Library',
  description: 'Upload a photo or URL and transform recipes into a beautiful, searchable collection',
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
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Tiptopf-AI" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <TopNav />
        {children}
        <BottomNav />
        <div data-print-hide>
          <Toaster position="top-right" richColors />
        </div>
      </body>
    </html>
  )
}
