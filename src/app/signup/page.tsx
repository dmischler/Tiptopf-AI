import Link from 'next/link'

import { signUpAction } from '@/app/actions/auth'
import { AuthCardShell } from '@/components/auth/auth-card-shell'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type SignupPageProps = {
  searchParams?: Promise<{ error?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) ?? {}

  return (
    <AuthPageShell>
      <AuthCardShell
        title="Create your account"
        description="Start your private AI-powered recipe collection."
      >
        <form action={signUpAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
          </div>

          {params.error && (
            <p className="rounded-md border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {params.error}
            </p>
          )}

          <Button type="submit" className="w-full">
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </AuthCardShell>
    </AuthPageShell>
  )
}
