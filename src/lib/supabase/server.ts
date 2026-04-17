import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieList = {
  name: string
  value: string
  options?: {
    domain?: string
    expires?: Date
    httpOnly?: boolean
    maxAge?: number
    path?: string
    priority?: 'low' | 'medium' | 'high'
    sameSite?: true | false | 'lax' | 'strict' | 'none'
    secure?: boolean
  }
}[]

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookieList: CookieList) => {
          cookieList.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
