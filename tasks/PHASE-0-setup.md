# Phase 0: Project Setup & Configuration

**Duration:** ~1 hour  
**Goal:** Initialize Next.js project with all dependencies and shadcn/ui

> **Note:** The project scaffold already exists. Focus on installing missing dependencies and configuring shadcn/ui.

## Steps

### 0.1 Install Missing Dependencies
```bash
npm install @supabase/ssr next-themes zod @noble/ciphers @noble/hashes
```

Packages already installed (from package.json):
- `@supabase/supabase-js`, `ai`, `@ai-sdk/openai`, `next`, `react`, `react-dom`
- `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`

> **Not installed:** `masonry-css` — we use pure CSS columns instead (no JS masonry library).

### 0.2 Initialize shadcn/ui
```bash
npx shadcn@latest init -d -y
npx shadcn@latest add button input label textarea dialog tabs card badge avatar form toast switch select dropdown-menu separator sheet
```

This creates `components.json` and installs the required shadcn/ui components.

### 0.3 Configure Environment Variables
`.env.example` already exists. Add a `SUPABASE_SERVICE_ROLE_KEY` entry for server-side operations:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 0.4 Fix `next.config.js` — Scope Remote Patterns
Replace the wildcard `hostname: '**'` with the actual Supabase storage domain:

```js
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '*.supabase.co',
    },
  ],
},
```

Add additional domains as needed for external recipe images.

### 0.5 Replace `src/lib/supabase.ts`
Delete the current placeholder. Supabase client files will be created in PHASE-2 at:
- `src/lib/supabase/client.ts` (browser client)
- `src/lib/supabase/server.ts` (server client with cookie handling)

## Files to Create/Modify
- `package.json` — add missing dependencies (run npm install)
- `components.json` — created by shadcn init
- `next.config.js` — scope image remotePatterns
- `.env.local` — create from .env.example with real values
- DELETE `src/lib/supabase.ts` — replaced by PHASE-2 files

## Verification
- [ ] `npm run dev` starts without errors
- [ ] shadcn/ui components render (test with a simple Button)
- [ ] All new dependencies listed in package.json