'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  ACCESS_PIN_COOKIE,
  accessPinCookieOptions,
  cookieValueForPin,
  getConfiguredAccessPin,
  pinMatches,
  safeInternalPath,
} from '@/lib/access-pin'

export async function submitAccessPinAction(formData: FormData) {
  const configured = getConfiguredAccessPin()
  const nextPath = safeInternalPath(formData.get('next'))

  if (!configured) {
    redirect('/library')
  }

  const entered = typeof formData.get('pin') === 'string' ? String(formData.get('pin')) : ''
  if (!pinMatches(entered, configured)) {
    const errorUrl = nextPath === '/library' ? '/gate?error=1' : `/gate?error=1&next=${encodeURIComponent(nextPath)}`
    redirect(errorUrl)
  }

  const jar = await cookies()
  jar.set(ACCESS_PIN_COOKIE, cookieValueForPin(configured), accessPinCookieOptions())
  redirect(nextPath)
}
