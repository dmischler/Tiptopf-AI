import Link from 'next/link'

import { ApiKeyForm } from '@/components/profile/api-key-form'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { DEFAULT_BASE_URL } from '@/lib/ai/client'
import { getProfile } from '@/lib/local/store'

export default async function ProfilePage() {
  const profile = await getProfile()
  const initials = profile.email.slice(0, 2).toUpperCase() || 'RP'

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
          <CardTitle>Local device mode</CardTitle>
          <CardDescription>
            This instance runs without in-app accounts. Access control is handled by Tailscale.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Profile</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <Badge variant="secondary">Single user</Badge>
          </div>

          <Separator />

          <Button type="button" variant="outline" disabled>
            Managed by Tailscale access
          </Button>
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
            userId={profile.id}
            initialEncryptedApiKey={profile?.encrypted_api_key ?? null}
            initialBaseUrl={profile?.api_base_url ?? DEFAULT_BASE_URL}
          />
        </CardContent>
      </Card>
    </main>
  )
}
