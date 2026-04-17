# Phase 2: Authentication System

**Duration:** ~2 hours  
**Goal:** Email/password auth with Supabase, theme toggle, API key management

## Steps

### 2.1 Supabase Client Setup
Create `src/lib/supabase/client.ts` (browser):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Create `src/lib/supabase/server.ts` (server):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookieList) => {
          cookieList.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

Create `src/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookieList) => {
          cookieList.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse.cookies.setAll(cookieList)
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login (except auth pages)
  if (!user && !request.nextUrl.pathname.startsWith('/login') &&
      !request.nextUrl.pathname.startsWith('/signup') &&
      !request.nextUrl.pathname.startsWith('/forgot-password') &&
      !request.nextUrl.pathname.startsWith('/reset-password')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (user && (request.nextUrl.pathname.startsWith('/login') ||
      request.nextUrl.pathname.startsWith('/signup'))) {
    return NextResponse.redirect(new URL('/library', request.url))
  }

  return supabaseResponse
}
```

Create `src/middleware.ts`:
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|png|gif|webp)$).*)'],
}
```

### 2.2 Auth Pages (flat routes)
Create these pages:
- `src/app/login/page.tsx` — Login form (email + password)
- `src/app/signup/page.tsx` — Signup form (email + password)
- `src/app/forgot-password/page.tsx` — Password reset request
- `src/app/reset-password/page.tsx` — Set new password

Each page should use shadcn/ui `Card`, `Input`, `Button`, `Label` components.

**Supabase Auth config needed:**
1. Enable email auth in Supabase Dashboard → Authentication → Providers
2. Set Site URL to your Vercel deployment URL
3. Configure email templates (optional — default Supabase templates work)
4. Add redirect URLs: `http://localhost:3000/**` and `https://your-domain.com/**`

### 2.3 Theme Provider
Install: `npm install next-themes` (already listed in Phase 0)

Create `src/components/theme-provider.tsx`:
```typescript
'use client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="recipin-theme">
      {children}
    </NextThemesProvider>
  )
}
```

Add to `src/app/layout.tsx`:
```typescript
import { ThemeProvider } from '@/components/theme-provider'

// Wrap <body> children with <ThemeProvider>
```

Add theme toggle button (e.g. in header or sidebar) using `useTheme()` from `next-themes`.

> **Theme storage:** localStorage only (`recipin-theme` key), per device. No DB sync.

### 2.4 API Key Management
Create `src/components/profile/api-key-form.tsx`:
- Input for OpenCode Go API key
- Input for base URL (default: `https://api.opencode.ai/v1`)
- "Save" button stores encrypted key to `profiles` table
- "Show/Hide" toggle on the key input
- Display as masked (e.g. `sk-***...***`) when saved

### 2.5 Encryption Utilities (Web Crypto API)
Create `src/lib/crypto.ts`:
```typescript
// Uses the browser's built-in Web Crypto API — no external packages needed
// Derives an AES-GCM key from the user's Supabase UID + a pepper
// Encrypts the API key before storing in profiles table
// Decrypts on-the-fly when needed for AI calls

const PEPPER = 'recipin-encryption-v1' // App-level pepper combined with user UID

export async function encryptApiKey(plaintext: string, userId: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId + PEPPER),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )
  // Combine salt + iv + ciphertext and base64 encode
  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(encrypted), salt.length + iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptApiKey(ciphertext: string, userId: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 28)
  const data = combined.slice(28)
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId + PEPPER),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )
  return new TextDecoder().decode(decrypted)
}
```

> **Note:** Uses Web Crypto API (built into all modern browsers) instead of `@noble/hashes`. No external crypto dependency needed. Derives the key from the user's Supabase UID so each user has a unique encryption key.

### 2.6 Profile Page
Create `src/app/profile/page.tsx`:
- Shows user email
- Theme toggle (dark/light)
- API key form (encrypt + save to `profiles` table)
- Logout button

## Files to Create
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/middleware.ts`
- `src/middleware.ts`
- `src/app/login/page.tsx`
- `src/app/signup/page.tsx`
- `src/app/forgot-password/page.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/profile/page.tsx`
- `src/components/theme-provider.tsx`
- `src/components/profile/api-key-form.tsx`
- `src/lib/crypto.ts`

## Files to Delete
- `src/lib/supabase.ts` (replaced by client.ts + server.ts)

## Verification
- [x] Auth routes and middleware implemented (`/login`, `/signup`, `/forgot-password`, `/reset-password`)
- [x] Protected route behavior implemented (`/library`, `/profile` redirect to `/login` when not authenticated)
- [x] Theme provider + toggle implemented with localStorage key `recipin-theme`
- [x] API key form implemented with client-side encryption and profile save action
- [x] Build verification passed (`npm run build`)
- [ ] End-to-end Supabase auth verification in browser (requires configured Supabase project and keys)
- [ ] Live encryption/decryption round-trip against real `profiles` row

## Phase 2 Implementation Notes (April 17, 2026)
- Kept auth flow simple with server actions and query-param feedback messages.
- Added a minimal `/library` placeholder page so redirects have a valid destination before Phase 5.
- Added `/` redirect logic: authenticated users go to `/library`, others to `/login`.
- Used `sonner` toaster for lightweight UX feedback without extra complexity.
