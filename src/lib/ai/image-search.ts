import { z } from 'zod'

import type { RecipeImageCandidate } from '@/lib/ai/image-types'

const PEXELS_API_BASE_URL = 'https://api.pexels.com/v1/search'

const pexelsPhotoSchema = z.object({
  id: z.number(),
  alt: z.string().nullable().optional(),
  photographer: z.string(),
  photographer_url: z.string().url(),
  src: z.object({
    large: z.string().url(),
    medium: z.string().url(),
  }),
})

const pexelsSearchResponseSchema = z.object({
  photos: z.array(pexelsPhotoSchema),
})

export async function searchPexelsImages(
  query: string,
  pexelsApiKey: string,
  limit = 8
): Promise<RecipeImageCandidate[]> {
  const apiKey = pexelsApiKey.trim()
  if (!apiKey) {
    return []
  }

  const url = new URL(PEXELS_API_BASE_URL)
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', String(Math.max(1, Math.min(limit, 15))))
  url.searchParams.set('orientation', 'landscape')

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: apiKey,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Pexels search failed with status ${response.status}`)
  }

  const parsed = pexelsSearchResponseSchema.parse(await response.json())

  return parsed.photos.map((photo) => ({
    id: `pexels-${photo.id}`,
    source: 'pexels' as const,
    url: photo.src.large,
    thumbnailUrl: photo.src.medium,
    alt: photo.alt?.trim() || 'Recipe image',
    creditName: photo.photographer,
    creditUrl: photo.photographer_url,
  }))
}
