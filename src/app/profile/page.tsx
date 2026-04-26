import { getProfile } from '@/lib/local/store'

export default async function ProfilePage() {
  const profile = await getProfile()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 pb-[max(6rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profil</h1>
        <p className="text-sm text-muted-foreground">
          Deine persönlichen Einstellungen.
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-muted/25 p-4 space-y-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">E-Mail</div>
          <div className="text-sm font-medium">{profile.email}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">ID</div>
          <div className="text-sm font-medium">{profile.id}</div>
        </div>
      </div>
    </main>
  )
}
