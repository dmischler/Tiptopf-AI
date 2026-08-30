const SAFE_IMAGE_NAME_RE = /^[A-Za-z0-9._-]+$/
export const CANONICAL_RECIPE_IMAGE_URL_RE = /^\/api\/images\/[0-9a-f-]{36}\.webp$/i

export function isSafeImageName(value: string) {
  return SAFE_IMAGE_NAME_RE.test(value) && !value.includes('..')
}

export function parseApiImageFileName(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) {
    return null
  }

  const pathname = imageUrl.trim().split(/[?#]/)[0]
  const match = /^\/api\/images\/([^/]+)$/i.exec(pathname)
  if (!match) {
    return null
  }

  let name: string
  try {
    name = decodeURIComponent(match[1])
  } catch {
    return null
  }

  return isSafeImageName(name) ? name : null
}

export function isCanonicalRecipeImageUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }

  return CANONICAL_RECIPE_IMAGE_URL_RE.test(value.trim().split(/[?#]/)[0])
}

export function canonicalRecipeImageUrl(recipeId: string): string {
  return `/api/images/${recipeId}.webp`
}

export function toImageUrl(fileName: string, version?: string) {
  const base = `/api/images/${encodeURIComponent(fileName)}`
  if (!version) {
    return base
  }

  return `${base}?v=${encodeURIComponent(version)}`
}

export function toRecipeImageSrc(recipe: {
  image_url: string | null
  updated_at?: string | null
}): string | null {
  if (!recipe.image_url) {
    return null
  }

  const fileName = parseApiImageFileName(recipe.image_url)
  if (!fileName) {
    return recipe.image_url
  }

  return toImageUrl(fileName, recipe.updated_at ?? undefined)
}
