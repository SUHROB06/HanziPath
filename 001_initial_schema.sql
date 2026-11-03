-- HanziPath initial schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.vocabulary (
  id uuid primary key default gen_random_uuid(),
  system text not null check (system in ('2.0','3.0')),
  level integer not null,
  hanzi text not null,
  pinyin text not null,
  translation_ru text not null,
  translation_en text not null,
  example_hanzi text,
  example_pinyin text,
  example_ru text,
  audio_url text,
  source_name text,
  source_version text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique(system, level, hanzi)
);

create table if not exists public.grammar_lessons (
  id uuid primary key default gen_random_uuid(),
  system text not null check (system in ('2.0','3.0')),
  level integer not null,
  title_ru text not null,
  title_en text not null,
  explanation_ru text,
  explanation_en text,
  examples jsonb not null default '[]'::jsonb
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  system text not null check (system in ('2.0','3.0')),
  level integer not null,
  kind text not null check (kind in ('listening','sentence_order','quiz')),
  prompt jsonb not null,
  answer jsonb not null,
  explanation_ru text,
  explanation_en text
);

create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_id uuid references public.vocabulary(id) on delete cascade,
  status text not null default 'new' check (status in ('new','learning','known','forgotten')),
  repetitions integer not null default 0,
  interval_days integer not null default 0,
  ease_factor numeric not null default 2.5,
  due_at timestamptz,
  last_reviewed_at timestamptz,
  unique(user_id, vocabulary_id)
);

create table if not exists public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default current_date,
  words_reviewed integer not null default 0,
  exercises_completed integer not null default 0,
  minutes_studied integer not null default 0,
  unique(user_id, activity_date)
);

alter table public.vocabulary enable row level security;
alter table public.grammar_lessons enable row level security;
alter table public.exercises enable row level security;
alter table public.user_progress enable row level security;
alter table public.daily_activity enable row level security;

create policy "Vocabulary is readable by everyone" on public.vocabulary for select using (true);
create policy "Grammar is readable by everyone" on public.grammar_lessons for select using (true);
create policy "Exercises are readable by everyone" on public.exercises for select using (true);
create policy "Users manage their own progress" on public.user_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own daily activity" on public.daily_activity for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists vocabulary_system_level_idx on public.vocabulary(system, level);
create index if not exists progress_due_idx on public.user_progress(user_id, due_at);
