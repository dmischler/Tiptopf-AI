'use client'

import { useMemo, useState } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveProfileApiSettings } from '@/app/actions/profile'
import { DEFAULT_BASE_URL } from '@/lib/ai/client'
import { encryptApiKey, maskApiKey } from '@/lib/crypto'

type ApiKeyFormProps = {
  userId: string
  initialEncryptedApiKey: string | null
  initialBaseUrl: string | null
}

export function ApiKeyForm({
  userId,
  initialEncryptedApiKey,
  initialBaseUrl,
}: ApiKeyFormProps) {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl ?? DEFAULT_BASE_URL)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasSavedApiKey, setHasSavedApiKey] = useState(Boolean(initialEncryptedApiKey))

  const maskedSavedKey = useMemo(() => {
    if (!hasSavedApiKey) return null
    if (apiKey.trim()) return maskApiKey(apiKey.trim())
    return '****...****'
  }, [apiKey, hasSavedApiKey])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedBaseUrl = baseUrl.trim() || DEFAULT_BASE_URL
    const normalizedBaseUrl = trimmedBaseUrl.replace(/\/$/, '')
    const hasNewApiKey = apiKey.trim().length > 0

    if (!hasSavedApiKey && !hasNewApiKey) {
      toast.error('Please enter your OpenCode Go API key.')
      return
    }

    if (!/^https?:\/\//i.test(normalizedBaseUrl)) {
      toast.error('Base URL must start with http:// or https://')
      return
    }

    setIsSaving(true)
    try {
      const encryptedApiKey = hasNewApiKey
        ? await encryptApiKey(apiKey.trim(), userId)
        : null

      await saveProfileApiSettings({
        encryptedApiKey,
        apiBaseUrl: normalizedBaseUrl,
      })

      if (hasNewApiKey) {
        setApiKey('')
        setHasSavedApiKey(true)
      }
      setBaseUrl(normalizedBaseUrl)
      toast.success('Profile API settings saved.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile settings.'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="api-key">OpenCode Go API key</Label>
        <div className="relative">
          <Input
            id="api-key"
            type={showApiKey ? 'text' : 'password'}
            placeholder="sk-..."
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {maskedSavedKey && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" />
            Saved key: {maskedSavedKey}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="base-url">API base URL</Label>
        <Input
          id="base-url"
          type="url"
          placeholder={DEFAULT_BASE_URL}
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          autoComplete="off"
        />
      </div>

      <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save
      </Button>
    </form>
  )
}
