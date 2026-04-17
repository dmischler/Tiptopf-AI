# ReciPin

Your beautiful, AI-powered Pinterest-style recipe library.

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env.local` and fill in your Supabase credentials
3. Install dependencies:

```bash
npm install
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Setup Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key
3. Create the `recipes` table with the schema from VISION.md
4. Enable Row Level Security

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + Database + Storage)
- Vercel AI SDK