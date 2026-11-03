-- Additive Uzbek localization and per-user language preference migration.
-- Safe to apply to an existing project: no vocabulary rows or progress are deleted or rewritten.

alter table public.vocabulary
  add column if not exists translation_uz text,
  add column if not exists example_uz text,
  add column if not exists translation_uz_source text,
  add column if not exists translation_uz_source_version text,
  add column if not exists translation_uz_verified boolean not null default false,
  add column if not exists translation_uz_verified_by text,
  add column if not exists translation_uz_verified_at timestamptz,
  add column if not exists example_uz_source text,
  add column if not exists example_uz_source_version text,
  add column if not exists example_uz_verified boolean not null default false,
  add column if not exists example_uz_verified_by text,
  add column if not exists example_uz_verified_at timestamptz;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'ru' check (language in ('ru', 'en', 'uz')),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
drop policy if exists "Users manage their own preferences" on public.user_preferences;
create policy "Users manage their own preferences"
  on public.user_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

