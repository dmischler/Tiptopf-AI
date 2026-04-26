import { BackupRestoreSection } from '@/components/profile/backup-restore'
import { SettingsForm } from '@/components/profile/settings-form'
import { getProfile, getSettings } from '@/lib/local/store'

export default async function ProfilePage() {
  const [profile, settings] = await Promise.all([getProfile(), getSettings()])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 pb-[max(6rem,env(safe-area-inset-bottom))] md:pb-8 sm:px-6 lg:px-8">
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

      <section className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">API- und Modell-Konfiguration</h2>
        <p className="text-sm text-muted-foreground">
          Hinterlege alle API-Keys und Modellwerte direkt hier. Leere Felder setzen den Wert zurueck.
        </p>
      </section>

      <SettingsForm settings={settings} />

      <div className="border-t border-border/70 pt-6" />

      <BackupRestoreSection />
    </main>
  )
}
