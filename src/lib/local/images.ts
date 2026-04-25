import path from 'node:path'
import { promises as fs } from 'node:fs'
import sharp from 'sharp'

import { getRecipeImagesDir } from '@/lib/local/paths'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_UPLOADED_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const MAX_DOWNLOADED_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_WIDTH = 1200
const IMAGE_QUALITY = 85

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function toNormalizedMime(value: string | null) {
  if (!value) {
    return 'image/jpeg'
  }

  return value.split(';')[0].trim().toLowerCase()
}

function isSafeImageName(value: string) {
  return /^[A-Za-z0-9._-]+$/.test(value) && !value.includes('..')
}

function toImageUrl(fileName: string) {
  return `/api/images/${encodeURIComponent(fileName)}`
}

async function ensureRecipeImagesDir() {
  await fs.mkdir(getRecipeImagesDir(), { recursive: true })
}

async function removeRecipeImageVariants(recipeId: string) {
  await ensureRecipeImagesDir()
  const entries = await fs.readdir(getRecipeImagesDir())
  const prefix = `${recipeId}.`

  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix))
      .map((name) => fs.rm(path.join(getRecipeImagesDir(), name), { force: true }))
  )
}

function extensionFromUrl(url: string) {
  const pathname = new URL(url).pathname.toLowerCase()

  if (pathname.endsWith('.png')) {
    return 'png'
  }

  if (pathname.endsWith('.webp')) {
    return 'webp'
  }

  return 'jpg'
}

function extensionFromMime(mime: string, fallbackUrl?: string) {
  if (EXT_BY_CONTENT_TYPE[mime]) {
    return EXT_BY_CONTENT_TYPE[mime]
  }

  if (fallbackUrl) {
    try {
      return extensionFromUrl(fallbackUrl)
    } catch {
      return 'jpg'
    }
  }

  return 'jpg'
}

async function resizeToWebp(bytes: Uint8Array): Promise<Uint8Array> {
  const buffer = await sharp(Buffer.from(bytes))
    .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
    .webp({ quality: IMAGE_QUALITY })
    .toBuffer()
  return new Uint8Array(buffer)
}

async function writeRecipeImage(recipeId: string, bytes: Uint8Array, ext: string) {
  await ensureRecipeImagesDir()
  await removeRecipeImageVariants(recipeId)

  const fileName = `${recipeId}.${ext}`
  const filePath = path.join(getRecipeImagesDir(), fileName)
  await fs.writeFile(filePath, bytes)

  return toImageUrl(fileName)
}

export async function saveRecipeImageBytes(
  bytes: Uint8Array,
  recipeId: string,
  mimeType: string | null = null
) {
  if (bytes.byteLength > MAX_DOWNLOADED_IMAGE_SIZE_BYTES) {
    throw new Error('Image exceeds 10MB limit')
  }

  const normalizedMime = toNormalizedMime(mimeType)
  if (!ALLOWED_IMAGE_TYPES.has(normalizedMime)) {
    throw new Error('Only JPG, PNG, and WEBP images are supported')
  }

  const resized = await resizeToWebp(bytes)
  return writeRecipeImage(recipeId, resized, 'webp')
}

export async function saveUploadedRecipeImage(file: File, recipeId: string) {
  const mime = toNormalizedMime(file.type)

  if (!ALLOWED_IMAGE_TYPES.has(mime)) {
    throw new Error('Only JPG, PNG, and WEBP images are supported')
  }

  if (file.size > MAX_UPLOADED_IMAGE_SIZE_BYTES) {
    throw new Error('Image must be 5MB or smaller')
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const resized = await resizeToWebp(bytes)
  return writeRecipeImage(recipeId, resized, 'webp')
}

export async function downloadImageToLocalStorage(imageUrl: string, recipeId: string) {
  const response = await fetch(imageUrl, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > MAX_DOWNLOADED_IMAGE_SIZE_BYTES) {
    throw new Error('Downloaded image exceeds 10MB limit')
  }

  const resized = await resizeToWebp(bytes)
  return writeRecipeImage(recipeId, resized, 'webp')
}

export async function readRecipeImage(imageName: string) {
  const decoded = decodeURIComponent(imageName)
  if (!isSafeImageName(decoded)) {
    throw new Error('Invalid image name')
  }

  const filePath = path.join(getRecipeImagesDir(), decoded)
  const buffer = await fs.readFile(filePath)
  const ext = path.extname(decoded).toLowerCase()
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream'

  return {
    buffer,
    contentType,
  }
}
