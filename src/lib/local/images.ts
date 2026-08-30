import path from 'node:path'
import { promises as fs } from 'node:fs'
import sharp from 'sharp'

import { safeFetch } from '@/lib/http/safe-fetch'
import { writeFileDurable } from '@/lib/local/durable-write'
import { getRecipeImagesDir } from '@/lib/local/paths'
import {
  ALLOWED_UPLOADED_IMAGE_MIME_TYPES,
  canonicalRecipeImageUrl,
  isSafeImageName,
  MAX_UPLOADED_IMAGE_SIZE_BYTES,
  parseApiImageFileName,
  toImageUrl,
} from '@/lib/recipe-image'
import type { Recipe } from '@/types'

export { isSafeImageName, toImageUrl }

const ALLOWED_SHARP_FORMATS = new Set(['jpeg', 'png', 'webp'])
const MAX_DOWNLOADED_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_WIDTH = 1200
const IMAGE_QUALITY = 85
const RECIPE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function isEnoent(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

function toNormalizedMime(value: string | null) {
  if (!value) {
    return 'image/jpeg'
  }

  return value.split(';')[0].trim().toLowerCase()
}

function getTrashDir() {
  return path.join(getRecipeImagesDir(), '.trash')
}

function canonicalFileName(recipeId: string) {
  return `${recipeId}.webp`
}

function assertRecipeId(recipeId: string) {
  if (!RECIPE_ID_RE.test(recipeId)) {
    throw new Error('Invalid recipe id')
  }
}

function assertSafeImageFileName(fileName: string) {
  if (!isSafeImageName(fileName) || fileName !== path.basename(fileName)) {
    throw new Error('Invalid image name')
  }
}

function resolvePathInsideDir(dir: string, fileName: string) {
  assertSafeImageFileName(fileName)
  const root = path.resolve(dir)
  const filePath = path.resolve(root, fileName)
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  if (!filePath.startsWith(prefix)) {
    throw new Error('Invalid image path')
  }
  return filePath
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    if (isEnoent(error)) {
      return false
    }
    throw error
  }
}

async function removeOtherRecipeImageVariants(recipeId: string, keepFileName: string) {
  const imagesDir = getRecipeImagesDir()
  let entries: string[]
  try {
    entries = await fs.readdir(imagesDir)
  } catch (error) {
    if (isEnoent(error)) {
      return
    }
    throw error
  }

  const prefix = `${recipeId}.`

  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix) && name !== keepFileName)
      .map((name) => fs.rm(path.join(imagesDir, name), { force: true }))
  )
}

async function resizeToWebp(bytes: Uint8Array): Promise<Uint8Array> {
  const input = Buffer.from(bytes)
  const metadata = await sharp(input, { failOn: 'truncated' }).metadata()
  if (!metadata.format || !ALLOWED_SHARP_FORMATS.has(metadata.format)) {
    throw new Error('Only JPG, PNG, and WEBP images are supported')
  }

  const buffer = await sharp(input)
    .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
    .webp({ quality: IMAGE_QUALITY })
    .toBuffer()
  return new Uint8Array(buffer)
}

async function writeRecipeImage(recipeId: string, bytes: Uint8Array) {
  assertRecipeId(recipeId)
  const fileName = canonicalFileName(recipeId)
  const filePath = resolvePathInsideDir(getRecipeImagesDir(), fileName)
  await writeFileDurable(filePath, bytes)
  await removeOtherRecipeImageVariants(recipeId, fileName)

  return toImageUrl(fileName)
}

export async function saveUploadedRecipeImage(file: File, recipeId: string) {
  const mime = toNormalizedMime(file.type)

  if (!ALLOWED_UPLOADED_IMAGE_MIME_TYPES.has(mime)) {
    throw new Error('Only JPG, PNG, and WEBP images are supported')
  }

  if (file.size > MAX_UPLOADED_IMAGE_SIZE_BYTES) {
    throw new Error('Image must be 5MB or smaller')
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const resized = await resizeToWebp(bytes)
  return writeRecipeImage(recipeId, resized)
}

export async function downloadImageToLocalStorage(imageUrl: string, recipeId: string) {
  assertRecipeId(recipeId)
  const fetched = await safeFetch(imageUrl, {
    timeoutMs: 15000,
    maxBytes: MAX_DOWNLOADED_IMAGE_SIZE_BYTES,
    purpose: 'image',
  })

  const resized = await resizeToWebp(fetched.bytes)
  return writeRecipeImage(recipeId, resized)
}

export async function readRecipeImage(imageName: string) {
  const decoded = decodeURIComponent(imageName)
  const filePath = resolvePathInsideDir(getRecipeImagesDir(), decoded)
  const buffer = await fs.readFile(filePath)
  const ext = path.extname(decoded).toLowerCase()
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream'

  return {
    buffer,
    contentType,
  }
}

function collectRecipeImageNames(recipe: Recipe) {
  const names = new Set<string>([
    canonicalFileName(recipe.id),
    `${recipe.id}.jpg`,
    `${recipe.id}.jpeg`,
    `${recipe.id}.png`,
  ])

  const fromUrl = parseApiImageFileName(recipe.image_url)
  if (fromUrl) {
    names.add(fromUrl)
  }

  return [...names].filter((name) => isSafeImageName(name))
}

export async function deleteRecipeImages(recipe: Recipe) {
  const imagesDir = getRecipeImagesDir()
  let entries: string[]
  try {
    entries = await fs.readdir(imagesDir)
  } catch (error) {
    if (isEnoent(error)) {
      return
    }
    throw error
  }

  const prefix = `${recipe.id}.`
  const extraName = parseApiImageFileName(recipe.image_url)
  const toDelete = entries.filter((name) => {
    if (name.startsWith(prefix)) {
      return true
    }
    return Boolean(extraName && name === extraName)
  })

  await Promise.all(toDelete.map((name) => fs.rm(path.join(imagesDir, name), { force: true })))
}

async function placeWebpInTrash(recipeId: string, sourcePath: string, sourceName: string) {
  const trashDir = getTrashDir()
  await fs.mkdir(trashDir, { recursive: true })
  const dest = path.join(trashDir, canonicalFileName(recipeId))
  assertSafeImageFileName(canonicalFileName(recipeId))

  if (sourceName.toLowerCase().endsWith('.webp')) {
    await fs.rm(dest, { force: true })
    await fs.rename(sourcePath, dest)
    return
  }

  const bytes = await fs.readFile(sourcePath)
  const resized = await resizeToWebp(new Uint8Array(bytes))
  await writeFileDurable(dest, resized)
  await fs.rm(sourcePath, { force: true })
}

export async function trashRecipeImages(recipe: Recipe) {
  const imagesDir = getRecipeImagesDir()
  const names = collectRecipeImageNames(recipe)
  let placed = false

  for (const name of names) {
    const sourcePath = path.join(imagesDir, name)
    if (!(await pathExists(sourcePath))) {
      continue
    }

    if (!placed) {
      await placeWebpInTrash(recipe.id, sourcePath, name)
      placed = true
    } else {
      await fs.rm(sourcePath, { force: true })
    }
  }
}

export async function restoreTrashedRecipeImage(recipeId: string): Promise<boolean> {
  const fileName = canonicalFileName(recipeId)
  assertSafeImageFileName(fileName)

  const imagesDir = getRecipeImagesDir()
  const trashPath = path.join(getTrashDir(), fileName)
  const dest = path.join(imagesDir, fileName)

  if (!(await pathExists(trashPath))) {
    return pathExists(dest)
  }

  await fs.mkdir(imagesDir, { recursive: true })
  await fs.rm(dest, { force: true })
  await fs.rename(trashPath, dest)
  await removeOtherRecipeImageVariants(recipeId, fileName)
  return true
}

export async function purgeTrashedRecipeImage(recipeId: string) {
  const fileName = canonicalFileName(recipeId)
  assertSafeImageFileName(fileName)
  await fs.rm(path.join(getTrashDir(), fileName), { force: true })
}

export async function purgeAllTrashedRecipeImages() {
  const trashDir = getTrashDir()
  let entries: string[]
  try {
    entries = await fs.readdir(trashDir)
  } catch (error) {
    if (isEnoent(error)) {
      return
    }
    throw error
  }

  await Promise.all(entries.map((name) => fs.rm(path.join(trashDir, name), { force: true, recursive: true })))
}

export async function migrateRecipeImageFile(recipe: Recipe): Promise<string | null> {
  const canonicalName = canonicalFileName(recipe.id)
  const canonicalUrl = canonicalRecipeImageUrl(recipe.id)
  const fileName = parseApiImageFileName(recipe.image_url)

  if (!fileName) {
    return null
  }

  if (fileName === canonicalName) {
    return canonicalUrl
  }

  const imagesDir = getRecipeImagesDir()
  const oldPath = path.join(imagesDir, fileName)
  const newPath = path.join(imagesDir, canonicalName)

  if (!(await pathExists(oldPath))) {
    return null
  }

  if (fileName.toLowerCase().endsWith('.webp')) {
    if (oldPath !== newPath) {
      await fs.rm(newPath, { force: true })
      await fs.rename(oldPath, newPath)
    }
  } else {
    const bytes = await fs.readFile(oldPath)
    const resized = await resizeToWebp(new Uint8Array(bytes))
    await writeFileDurable(newPath, resized)
    if (oldPath !== newPath) {
      await fs.rm(oldPath, { force: true })
    }
  }

  await removeOtherRecipeImageVariants(recipe.id, canonicalName)
  return canonicalUrl
}
