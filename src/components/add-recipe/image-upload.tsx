'use client'

import { useRef } from 'react'
import { Camera, UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024

type ImageUploadProps = {
  disabled?: boolean
  onSelect: (imageBase64: string) => Promise<void> | void
  onError: (message: string) => void
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

export function ImageUpload({ disabled, onSelect, onError }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return

    if (!ALLOWED_TYPES.has(file.type)) {
      onError('Only JPG, PNG, and WEBP are supported.')
      return
    }

    if (file.size > MAX_BYTES) {
      onError('Image must be 10MB or smaller.')
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      if (!dataUrl) {
        onError('Could not parse image payload.')
        return
      }

      await onSelect(dataUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process image.'
      onError(message)
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border border-dashed border-border/80 bg-muted/35 p-8 text-center"
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (disabled) return
          void handleFile(event.dataTransfer.files?.[0] || null)
        }}
      >
        <UploadCloud className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Drag and drop a recipe photo</p>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP up to 10MB</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="mr-2 h-4 w-4" />
          Choose image
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="mr-2 h-4 w-4" />
          Use camera
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0] || null)
          event.currentTarget.value = ''
        }}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0] || null)
          event.currentTarget.value = ''
        }}
      />
    </div>
  )
}
