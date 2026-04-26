import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from '@/components/ui/sonner';
import { BottomNav } from '@/components/layout/bottom-nav';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Tiptopf-AI - Your AI-Powered Recipe Library',
  description: 'Upload a photo or URL and transform recipes into a beautiful, searchable collection',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f0f0f',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={cn("dark font-sans", geist.variable)}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <BottomNav />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}