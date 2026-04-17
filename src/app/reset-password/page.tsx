import Link from 'next/link'

import { resetPasswordAction } from '@/app/actions/auth'
import { AuthCardShell } from '@/components/auth/auth-card-shell'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ResetPasswordPageProps = {
  searchParams?: Promise<{ error?: string; message?: string }>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = (await searchParams) ?? {}

  return (
    <AuthPageShell>
      <AuthCardShell
        title="Choose a new password"
        description="Set a fresh password for your account."
      >
        <form action={resetPasswordAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
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
            Update password
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Back to{' '}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            sign in
          </Link>
        </p>
      </AuthCardShell>
    </AuthPageShell>
  )
}
