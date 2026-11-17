-- Per-user interface language preference.
-- Additive migration: does not modify vocabulary, lessons, or learning progress.

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'ru'
    check (language in ('ru', 'en', 'uz')),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

revoke all on table public.user_preferences from public, anon;
grant select, insert, update, delete on table public.user_preferences to authenticated;

drop policy if exists "Users manage their own preferences"
  on public.user_preferences;

create policy "Users manage their own preferences"
  on public.user_preferences
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
