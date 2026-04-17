import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AddRecipeLauncher } from '@/components/add-recipe/launcher'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function LibraryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { count } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your library</h1>
          <p className="text-sm text-muted-foreground">
            Auth is active. Recipe feed will be added in the next phases.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/profile" />}>
          Profile settings
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{count ?? 0} recipe{count === 1 ? '' : 's'} in your library</CardTitle>
          <CardDescription>
            Add a recipe with the floating + button. Full masonry feed arrives in the next phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Current view is intentionally simple while add/extract/save flow is stabilized.
        </CardContent>
      </Card>

      <AddRecipeLauncher />
    </main>
  )
}
