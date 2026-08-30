import Link from 'next/link'

export default function RecipeNotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-7xl flex-col items-center justify-center gap-3 px-4 py-8 pb-[max(6rem,env(safe-area-inset-bottom))] text-center md:pb-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Rezept nicht gefunden.</h1>
      <p className="text-sm text-muted-foreground">Das Rezept existiert nicht oder wurde gelöscht.</p>
      <Link
        href="/library"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Zur Bibliothek
      </Link>
    </main>
  )
}
