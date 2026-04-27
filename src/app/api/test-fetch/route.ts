import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Tiptopf-AI/1.0)',
      },
      cache: 'no-store',
    })

    const text = await response.text()

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      contentLength: text.length,
      preview: text.slice(0, 500),
    })
  } catch (error) {
    console.error('Test fetch error:', error)
    return NextResponse.json(
      {
        error: 'Fetch failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
