import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'

import { signOutAction } from '@/app/actions/auth'
import { ApiKeyForm } from '@/components/profile/api-key-form'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/server'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('encrypted_api_key, api_base_url')
    .eq('id', user.id)
    .single()

  const initials = user.email?.slice(0, 2).toUpperCase() ?? 'RP'

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Profile settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account and AI connection.</p>
          </div>
        </div>
        <Link href="/library" className={buttonVariants({ variant: 'outline' })}>
          Back to library
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Authenticated via Supabase email/password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Badge variant="secondary">Private</Badge>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Stored on this device (`recipin-theme`).</p>
            </div>
            <ThemeToggle />
          </div>

          <Separator />

          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Provider settings</CardTitle>
          <CardDescription>
            Your API key is encrypted in the browser before being saved to your profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeyForm
            userId={user.id}
            initialEncryptedApiKey={profile?.encrypted_api_key ?? null}
            initialBaseUrl={profile?.api_base_url ?? 'https://api.opencode.ai/v1'}
          />
        </CardContent>
      </Card>
    </main>
  )
}
