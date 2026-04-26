'use client'

import { Eye, EyeOff, Loader2, Save } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { updateSettingsAction } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DEFAULT_BASE_URL,
  DEFAULT_GEMINI_IMAGE_FALLBACK_MODEL_ID,
  DEFAULT_GEMINI_IMAGE_MODEL_ID,
  DEFAULT_MODEL_ID,
} from '@/lib/ai/client'
import type { AppSettings } from '@/types'

type SettingsFormProps = {
  settings: AppSettings
}

type SecretFieldProps = {
  id: string
  name: keyof Pick<AppSettings, 'opencode_api_key' | 'gemini_api_key' | 'pexels_api_key'>
  label: string
  defaultValue: string
  placeholder?: string
}

function SecretInputField({ id, name, label, defaultValue, placeholder }: SecretFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="bg-background/70"
          autoComplete="off"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'API-Key ausblenden' : 'API-Key anzeigen'}
          title={visible ? 'Ausblenden' : 'Anzeigen'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)

        startTransition(() => {
          updateSettingsAction(formData)
            .then(() => {
              toast.success('Einstellungen gespeichert.')
            })
            .catch((error) => {
              const message = error instanceof Error ? error.message : 'Speichern fehlgeschlagen.'
              toast.error(message)
            })
        })
      }}
    >
      <section className="space-y-4 rounded-xl border border-border/70 bg-muted/25 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">OpenCode</h2>
        <SecretInputField
          id="opencode_api_key"
          name="opencode_api_key"
          label="OpenCode API-Key"
          defaultValue={settings.opencode_api_key ?? ''}
          placeholder="sk-..."
        />
        <div className="space-y-2">
          <Label htmlFor="opencode_base_url">OpenCode Base URL</Label>
          <Input
            id="opencode_base_url"
            name="opencode_base_url"
            defaultValue={settings.opencode_base_url ?? ''}
            placeholder={DEFAULT_BASE_URL}
            className="bg-background/70"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="opencode_model_id">OpenCode Modell-ID</Label>
          <Input
            id="opencode_model_id"
            name="opencode_model_id"
            defaultValue={settings.opencode_model_id ?? ''}
            placeholder={DEFAULT_MODEL_ID}
            className="bg-background/70"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border/70 bg-muted/25 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gemini</h2>
        <SecretInputField
          id="gemini_api_key"
          name="gemini_api_key"
          label="Gemini API-Key"
          defaultValue={settings.gemini_api_key ?? ''}
          placeholder="AIza..."
        />
        <div className="space-y-2">
          <Label htmlFor="gemini_base_url">Gemini Base URL</Label>
          <Input
            id="gemini_base_url"
            name="gemini_base_url"
            defaultValue={settings.gemini_base_url ?? ''}
            placeholder="https://generativelanguage.googleapis.com/v1beta"
            className="bg-background/70"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gemini_image_model_id">Gemini Bildmodell</Label>
            <Input
              id="gemini_image_model_id"
              name="gemini_image_model_id"
              defaultValue={settings.gemini_image_model_id ?? ''}
              placeholder={DEFAULT_GEMINI_IMAGE_MODEL_ID}
              className="bg-background/70"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gemini_image_fallback_model_id">Gemini Fallback-Modell</Label>
            <Input
              id="gemini_image_fallback_model_id"
              name="gemini_image_fallback_model_id"
              defaultValue={settings.gemini_image_fallback_model_id ?? ''}
              placeholder={DEFAULT_GEMINI_IMAGE_FALLBACK_MODEL_ID}
              className="bg-background/70"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border/70 bg-muted/25 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pexels</h2>
        <SecretInputField
          id="pexels_api_key"
          name="pexels_api_key"
          label="Pexels API-Key"
          defaultValue={settings.pexels_api_key ?? ''}
          placeholder="pexels_api_key"
        />
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Speichern
        </Button>
      </div>
    </form>
  )
}
