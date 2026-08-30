import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  ACCESS_PIN_COOKIE,
  cookieMatchesPin,
  getConfiguredAccessPin,
} from '@/lib/access-pin'

function isPublicPath(pathname: string) {
  if (pathname === '/gate' || pathname.startsWith('/gate/')) {
    return true
  }

  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname === '/favicon.ico'
  ) {
    return true
  }

  return /\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$/i.test(pathname)
}

export function proxy(request: NextRequest) {
  const pin = getConfiguredAccessPin()
  if (!pin) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  if (cookieMatchesPin(request.cookies.get(ACCESS_PIN_COOKIE)?.value, pin)) {
    return NextResponse.next()
  }

  const isServerAction = request.headers.has('next-action')
  const isApi = pathname.startsWith('/api/')
  if (isServerAction || isApi || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return new NextResponse('Zugriff verweigert.', { status: 401 })
  }

  const gateUrl = request.nextUrl.clone()
  gateUrl.pathname = '/gate'
  gateUrl.search = ''
  const nextPath = `${pathname}${request.nextUrl.search}`
  if (nextPath.startsWith('/') && !nextPath.startsWith('//') && !nextPath.startsWith('/gate')) {
    gateUrl.searchParams.set('next', nextPath)
  }

  return NextResponse.redirect(gateUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
