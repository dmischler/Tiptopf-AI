import { BackupRestoreSection } from '@/components/profile/backup-restore'
import { SettingsForm } from '@/components/profile/settings-form'
import { getSettings } from '@/lib/local/store'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const settings = await getSettings()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pt-8 pb-[max(6rem,env(safe-area-inset-bottom))] standalone:pt-4 nav-top:pb-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Profil</h1>
        <p className="text-sm text-muted-foreground">
          API-Keys, Modelle und Backup.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">API- und Modell-Konfiguration</h2>
        <p className="text-sm text-muted-foreground">
          Hinterlege alle API-Keys und Modellwerte direkt hier. Leere Modell- und URL-Felder fallen
          auf die Standardwerte zurück. Leer lassen behält den gespeicherten Key. Zum Löschen den
          Haken setzen.
        </p>
      </section>

      <SettingsForm
        settings={{
          opencode_base_url: settings.opencode_base_url,
          opencode_model_id: settings.opencode_model_id,
          gemini_base_url: settings.gemini_base_url,
          gemini_model_id: settings.gemini_model_id,
          gemini_fallback_model_id: settings.gemini_fallback_model_id,
        }}
        hasSecrets={{
          opencode_api_key: Boolean(settings.opencode_api_key),
          gemini_api_key: Boolean(settings.gemini_api_key),
          pexels_api_key: Boolean(settings.pexels_api_key),
        }}
      />

      <div className="border-t border-border/70 pt-6" />

      <BackupRestoreSection />
    </main>
  )
}
