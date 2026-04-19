import { NextResponse } from 'next/server'

import { readRecipeImage } from '@/lib/local/images'

type RouteContext = {
  params: Promise<{
    imageName: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { imageName } = await context.params

  try {
    const { buffer, contentType } = await readRecipeImage(imageName)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to read image' }, { status: 400 })
  }
}
