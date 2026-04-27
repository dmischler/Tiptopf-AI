import { NextResponse } from 'next/server'
import { fetchRecipeUrl } from '@/lib/ai/url-fetcher'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    const result = await fetchRecipeUrl(url)
    return NextResponse.json({
      success: true,
      hasStructuredRecipe: !!result.structuredRecipe,
      contentLength: result.content.length,
      hasImageUrl: !!result.imageUrl,
      preview: result.content.slice(0, 500),
    })
  } catch (error) {
    console.error('fetchRecipeUrl test error:', error)
    return NextResponse.json(
      {
        error: 'fetchRecipeUrl failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
