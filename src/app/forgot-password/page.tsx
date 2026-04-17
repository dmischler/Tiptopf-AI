import Link from 'next/link'

import { requestPasswordResetAction } from '@/app/actions/auth'
import { AuthCardShell } from '@/components/auth/auth-card-shell'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ForgotPasswordPageProps = {
  searchParams?: Promise<{ error?: string; message?: string }>
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = (await searchParams) ?? {}

  return (
    <AuthPageShell>
      <AuthCardShell
        title="Reset your password"
        description="We will send a secure reset link to your email."
      >
        <form action={requestPasswordResetAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
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
            Send reset link
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
