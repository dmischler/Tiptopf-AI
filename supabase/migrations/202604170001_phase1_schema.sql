-- Tiptopf-AI MVP Phase 1
-- Supabase schema, RLS, and storage policies

create extension if not exists pgcrypto;

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  ingredients jsonb not null default '[]'::jsonb,
  instructions text not null default '',
  prep_time int not null default 0,
  cook_time int not null default 0,
  servings int not null default 1,
  category text not null default 'main',
  difficulty text not null default 'medium',
  rating numeric(2,1) default null,
  is_favorite boolean not null default false,
  image_url text,
  source_url text,
  source_type text not null default 'image' check (source_type in ('image', 'url', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_category_check
    check (category in ('starter', 'main', 'dessert', 'side', 'breakfast', 'snack')),
  constraint recipes_difficulty_check
    check (difficulty in ('easy', 'medium', 'hard'))
);

create index if not exists idx_recipes_user_id on public.recipes(user_id);
create index if not exists idx_recipes_category on public.recipes(category);
create index if not exists idx_recipes_is_favorite on public.recipes(is_favorite);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  encrypted_api_key text,
  api_base_url text not null default 'https://api.opencode.ai/v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_recipes_updated_at on public.recipes;
create trigger set_recipes_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Users can read own recipes" on public.recipes;
create policy "Users can read own recipes"
  on public.recipes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own recipes" on public.recipes;
create policy "Users can insert own recipes"
  on public.recipes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own recipes" on public.recipes;
create policy "Users can update own recipes"
  on public.recipes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own recipes" on public.recipes;
create policy "Users can delete own recipes"
  on public.recipes for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload images" on storage.objects;
create policy "Users can upload images"
  on storage.objects for insert
  with check (
    bucket_id = 'recipe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Anyone can view images" on storage.objects;
create policy "Anyone can view images"
  on storage.objects for select
  using (bucket_id = 'recipe-images');

drop policy if exists "Users can delete own images" on storage.objects;
create policy "Users can delete own images"
  on storage.objects for delete
  using (
    bucket_id = 'recipe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
