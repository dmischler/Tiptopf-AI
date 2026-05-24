'use client'

import { useRef } from 'react'
import { Camera, UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'

const MAX_BYTES = 10 * 1024 * 1024
const MAX_DIMENSION = 2048
const JPEG_QUALITY = 0.8

type ImageUploadProps = {
  disabled?: boolean
  onSelect: (imageBase64: string) => Promise<void> | void
  onError: (message: string) => void
}

function resizeImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not process image'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image. Try a different photo (JPG/PNG recommended).'))
    }

    img.src = url
  })
}

export function ImageUpload({ disabled, onSelect, onError }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      onError('Please select an image file.')
      return
    }

    if (file.size > MAX_BYTES) {
      onError('Image must be 10MB or smaller.')
      return
    }

    try {
      const dataUrl = await resizeImageToBase64(file)
      if (!dataUrl) {
        onError('Could not process image payload.')
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
        <p className="mt-1 text-xs text-muted-foreground">Any photo up to 10MB (auto-optimized for AI)</p>
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
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0] || null)
          event.currentTarget.value = ''
        }}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
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
