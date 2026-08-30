import { redirect } from 'next/navigation'

import { submitAccessPinAction } from '@/app/gate/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isAccessPinEnabled, safeInternalPath } from '@/lib/access-pin'

export const dynamic = 'force-dynamic'

type GatePageProps = {
  searchParams: Promise<{
    error?: string
    next?: string
  }>
}

export default async function GatePage({ searchParams }: GatePageProps) {
  if (!isAccessPinEnabled()) {
    redirect('/library')
  }

  const params = await searchParams
  const nextPath = safeInternalPath(params.next)
  const showError = params.error === '1'

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-8 pb-[max(6rem,env(safe-area-inset-bottom))]">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">PIN eingeben</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Diese Instanz ist mit einem Zugangscode geschützt.
        </p>
      </div>

      <form action={submitAccessPinAction} className="space-y-4 rounded-xl border border-border/70 bg-muted/25 p-4">
        <input type="hidden" name="next" value={nextPath} />
        <div className="space-y-2">
          <Label htmlFor="pin">PIN</Label>
          <Input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            required
            autoFocus
            className="bg-background/70"
          />
        </div>
        {showError ? (
          <p className="text-sm text-destructive">Falscher PIN. Versuche es nochmal.</p>
        ) : null}
        <Button type="submit" className="w-full">
          Weiter
        </Button>
      </form>
    </main>
  )
}
