import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReciPin - Your AI-Powered Recipe Library',
  description: 'Upload a photo or URL and transform recipes into a beautiful, searchable collection',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}