import Link from 'next/link'

import { signInAction } from '@/app/actions/auth'
import { AuthCardShell } from '@/components/auth/auth-card-shell'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; message?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {}

  return (
    <AuthPageShell>
      <AuthCardShell
        title="Welcome back"
        description="Sign in to open your private recipe library."
      >
        <form action={signInAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {params.error && (
            <p className="rounded-md border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {params.error}
            </p>
          )}
          {params.message && (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
              {params.message}
            </p>
          )}

          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          New to ReciPin?{' '}
          <Link href="/signup" className="text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </AuthCardShell>
    </AuthPageShell>
  )
}
