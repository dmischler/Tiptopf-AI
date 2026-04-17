import Link from 'next/link'
import { redirect } from 'next/navigation'

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
          <CardTitle>MVP progress</CardTitle>
          <CardDescription>
            Phase 2 foundation is ready: auth routes, protected pages, theme, and API key management.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Continue with Phase 3 to wire AI extraction and recipe parsing.
        </CardContent>
      </Card>
    </main>
  )
}
