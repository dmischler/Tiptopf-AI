'use client'

import Image from 'next/image'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Camera, ImageIcon, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import {
  applyRecipeImageCandidateAction,
  searchRecipeImageCandidatesAction,
} from '@/app/actions/extract-recipe'
import { ImageSelectionModal } from '@/components/add-recipe/image-selection-modal'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { RecipeImageCandidate } from '@/lib/ai/image-types'
import {
  ALLOWED_UPLOADED_IMAGE_MIME_TYPES,
  MAX_UPLOADED_IMAGE_SIZE_BYTES,
  toRecipeImageSrc,
} from '@/lib/recipe-image'
import type { RecipeCategory } from '@/types'

type ImageSelectionHostState = {
  open: boolean
  loading: boolean
  title: string
  candidates: RecipeImageCandidate[]
  onOpenChange: (open: boolean) => void
  onSelectCandidate: (candidate: RecipeImageCandidate) => void
  onRefreshSearch: () => void
}

const ImageSelectionHostContext = createContext<{
  setSelection: (state: ImageSelectionHostState | null) => void
} | null>(null)

export function ImageSelectionHost({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<ImageSelectionHostState | null>(null)
  const api = useMemo(() => ({ setSelection }), [])

  return (
    <ImageSelectionHostContext.Provider value={api}>
      {children}
      {selection ? (
        <ImageSelectionModal
          open={selection.open}
          loading={selection.loading}
          title={selection.title}
          candidates={selection.candidates}
          onOpenChange={selection.onOpenChange}
          onSelectCandidate={selection.onSelectCandidate}
          onRefreshSearch={selection.onRefreshSearch}
        />
      ) : null}
    </ImageSelectionHostContext.Provider>
  )
}

type ImageMeta = {
  creditName?: string
  creditUrl?: string
}

type UseRecipeImagePickerOpts = {
  recipeId?: string
  title: string
  category: RecipeCategory
}

export function useRecipeImagePicker(opts: UseRecipeImagePickerOpts) {
  const [candidates, setCandidates] = useState<RecipeImageCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blobUrl) {
      return
    }

    return () => {
      URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  function clearBlob() {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
    }
    setBlobUrl(null)
    setFile(null)
  }

  async function search() {
    const title = opts.title.trim()
    if (!title) {
      toast.error('Bitte zuerst einen Titel eingeben.')
      return [] as RecipeImageCandidate[]
    }

    setLoading(true)
    setError(null)
    try {
      const nextCandidates = await searchRecipeImageCandidatesAction(title, opts.category)
      setCandidates(nextCandidates)
      return nextCandidates
    } catch {
      setCandidates([])
      setError('Bildsuche gerade nicht möglich.')
      toast.error('Bildsuche gerade nicht möglich.')
      return [] as RecipeImageCandidate[]
    } finally {
      setLoading(false)
    }
  }

  async function apply(url: string) {
    clearBlob()
    if (opts.recipeId) {
      return applyRecipeImageCandidateAction(opts.recipeId, url)
    }
    return url
  }

  function onFile(nextFile: File) {
    if (!ALLOWED_UPLOADED_IMAGE_MIME_TYPES.has(nextFile.type)) {
      toast.error('Nur JPG, PNG und WEBP werden unterstützt.')
      return null
    }

    if (nextFile.size > MAX_UPLOADED_IMAGE_SIZE_BYTES) {
      toast.error('Das Bild darf höchstens 5 MB groß sein.')
      return null
    }

    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
    }

    const objectUrl = URL.createObjectURL(nextFile)
    setFile(nextFile)
    setBlobUrl(objectUrl)
    return objectUrl
  }

  return {
    candidates,
    loading,
    error,
    file,
    previewUrl: blobUrl,
    search,
    apply,
    onFile,
    clearBlob,
  }
}

type ImagePickerProps = {
  recipeId?: string
  title: string
  category: RecipeCategory
  imageUrl: string | null
  imageVersion?: string | null
  disabled?: boolean
  creditName?: string | null
  creditUrl?: string | null
  onImageUrlChange: (url: string | null) => void
  onFileChange?: (file: File | null) => void
}

function isLooseImageSrc(url: string) {
  return url.startsWith('blob:') || /^https?:\/\//i.test(url)
}

export function ImagePicker({
  recipeId,
  title,
  category,
  imageUrl,
  imageVersion,
  disabled,
  creditName,
  creditUrl,
  onImageUrlChange,
  onFileChange,
}: ImagePickerProps) {
  const picker = useRecipeImagePicker({ recipeId, title, category })
  const pickerRef = useRef(picker)
  pickerRef.current = picker
  const host = useContext(ImageSelectionHostContext)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const [selectionOpen, setSelectionOpen] = useState(false)
  const [isFinding, setIsFinding] = useState(false)
  const [pickedCredit, setPickedCredit] = useState<ImageMeta | null>(null)

  const storedUrl = toRecipeImageSrc({
    image_url: imageUrl,
    updated_at: imageVersion,
  })
  const displayUrl = picker.previewUrl ?? storedUrl
  const credit = pickedCredit ?? (creditName ? { creditName, creditUrl: creditUrl ?? undefined } : null)

  async function handleSearch() {
    if (!title.trim()) {
      toast.error('Bitte zuerst einen Titel eingeben.')
      return
    }

    setIsFinding(true)
    try {
      await picker.search()
      setSelectionOpen(true)
    } finally {
      setIsFinding(false)
    }
  }

  async function handleSelectCandidate(candidate: RecipeImageCandidate) {
    try {
      const nextUrl = await picker.apply(candidate.url)
      setPickedCredit({
        creditName: candidate.creditName,
        creditUrl: candidate.creditUrl,
      })
      onImageUrlChange(nextUrl)
      onFileChange?.(null)
      setSelectionOpen(false)
      toast.success('Bild aktualisiert.')
    } catch {
      toast.error('Bild konnte nicht übernommen werden.')
    }
  }

  const handleSelectCandidateRef = useRef(handleSelectCandidate)
  handleSelectCandidateRef.current = handleSelectCandidate

  function handleReplaceImage(nextFile: File | null) {
    if (!nextFile) {
      return
    }

    const objectUrl = picker.onFile(nextFile)
    if (!objectUrl) {
      return
    }

    setPickedCredit(null)
    onFileChange?.(nextFile)
    toast.success('Bild ersetzt.')
  }

  useEffect(() => {
    if (!host) {
      return
    }

    host.setSelection({
      open: selectionOpen,
      loading: picker.loading,
      title: title || 'Rezept',
      candidates: picker.candidates,
      onOpenChange: setSelectionOpen,
      onSelectCandidate: (candidate) => {
        void handleSelectCandidateRef.current(candidate)
      },
      onRefreshSearch: () => {
        void pickerRef.current.search()
      },
    })
  }, [host, picker.candidates, picker.loading, selectionOpen, title])

  useEffect(() => {
    if (!host) {
      return
    }

    return () => {
      host.setSelection(null)
    }
  }, [host])

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-4">
      <Label>Bild</Label>
      {displayUrl ? (
        <div className="relative h-56 overflow-hidden rounded-xl border border-border/70 bg-background/70 sm:h-72">
          {isLooseImageSrc(displayUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl} alt={title || 'Rezeptbild'} className="h-full w-full object-cover" />
          ) : (
            <Image
              src={displayUrl}
              alt={title || 'Rezeptbild'}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 90vw, 768px"
            />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
          Noch kein Bild. Bild suchen oder manuell ersetzen.
        </div>
      )}

      {credit?.creditName ? (
        <div className="text-xs text-muted-foreground">
          Foto von{' '}
          {credit.creditUrl ? (
            <a
              href={credit.creditUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {credit.creditName}
            </a>
          ) : (
            credit.creditName
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
          Foto aufnehmen
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {displayUrl ? 'Bild ersetzen' : 'Bild wählen'}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          onChange={(event) => {
            handleReplaceImage(event.target.files?.[0] || null)
            event.currentTarget.value = ''
          }}
        />

        <input
          ref={cameraInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          capture="environment"
          disabled={disabled}
          onChange={(event) => {
            handleReplaceImage(event.target.files?.[0] || null)
            event.currentTarget.value = ''
          }}
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void handleSearch()
          }}
          disabled={disabled || isFinding || picker.loading}
        >
          {isFinding || picker.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          {isFinding || picker.loading ? 'Bild wird gesucht...' : 'Bild suchen'}
        </Button>
      </div>

      {host ? null : (
        <ImageSelectionModal
          open={selectionOpen}
          loading={picker.loading}
          title={title || 'Rezept'}
          candidates={picker.candidates}
          onOpenChange={setSelectionOpen}
          onSelectCandidate={(candidate) => {
            void handleSelectCandidate(candidate)
          }}
          onRefreshSearch={() => {
            void picker.search()
          }}
        />
      )}
    </div>
  )
}
