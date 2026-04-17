# Phase 1: Supabase Database & Storage

**Duration:** ~1 hour  
**Goal:** Set up Supabase project with tables, RLS, and storage bucket

## Steps

### 1.1 Create Supabase Project
1. Go to supabase.com → New Project
2. Note: Project URL, anon key, service role key (keep secret!)
3. Update `.env.local` with all three keys

### 1.2 Create Recipes Table
```sql
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  ingredients JSONB NOT NULL DEFAULT '[]',
  instructions TEXT NOT NULL DEFAULT '',
  prep_time INT DEFAULT 0,
  cook_time INT DEFAULT 0,
  servings INT DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'main',
  difficulty TEXT DEFAULT 'medium',
  rating NUMERIC(2,1) DEFAULT NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  source_url TEXT,
  source_type TEXT CHECK (source_type IN ('image', 'url', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast per-user queries
CREATE INDEX idx_recipes_user_id ON public.recipes(user_id);
CREATE INDEX idx_recipes_category ON public.recipes(category);
CREATE INDEX idx_recipes_is_favorite ON public.recipes(is_favorite);
```

> **Note:** `source_type` tracks how the recipe was added ('image' = phone photo, 'url' = website URL, 'manual' = future use). `rating` is nullable (NULL = not rated yet).

### 1.3 Create Profile Table (with API key storage)
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  encrypted_api_key TEXT,
  api_base_url TEXT DEFAULT 'https://api.opencode.ai/v1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

> **Note:** No `theme` column — theme is stored in localStorage only, per VISION.md. API key is stored encrypted client-side before being saved to the DB.

### 1.4 Enable RLS
```sql
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Recipes: users can only access their own
CREATE POLICY "Users can manage own recipes" ON public.recipes
  FOR ALL USING (auth.uid() = user_id);

-- Profiles: users can only access their own
CREATE POLICY "Users can manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);
```

### 1.5 Create Storage Bucket
1. Supabase Dashboard → Storage → New Bucket
2. Name: `recipe-images`
3. Public: true (images are accessed via public URL for display)
4. File size limit: 5MB
5. Allowed MIME types: image/jpeg, image/png, image/webp

**Storage RLS policy:**
```sql
-- Users can upload to their own folder
CREATE POLICY "Users can upload images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'recipe-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read all images (public bucket)
CREATE POLICY "Anyone can view images" ON storage.objects
  FOR SELECT USING (bucket_id = 'recipe-images');

-- Users can delete their own images
CREATE POLICY "Users can delete own images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'recipe-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

## Files to Modify
- `.env.local` — add Supabase keys

## Files Added in Repository
- `supabase/migrations/202604170001_phase1_schema.sql` — canonical SQL for tables, triggers, RLS, and storage policies

## Verification
- [x] Migration SQL written and committed for reproducible setup
- [x] Migration includes tables, constraints, indexes, triggers, and RLS policies
- [x] Storage bucket + storage policies included in migration SQL
- [ ] Applied in Supabase project (requires dashboard or Supabase CLI with project credentials)
- [ ] Verified with live signup/storage test against Supabase project

## Phase 1 Implementation Notes (April 17, 2026)
- Added `updated_at` trigger support (`set_updated_at`) for `recipes` and `profiles`.
- Split broad `FOR ALL` RLS into explicit `SELECT/INSERT/UPDATE/DELETE` policies for clarity.
- Added category and difficulty check constraints directly in schema to match VISION categories.
