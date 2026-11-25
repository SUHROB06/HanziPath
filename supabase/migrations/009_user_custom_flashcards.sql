-- Personal Flash Cards: each authenticated student owns their cards and decks.
create table if not exists public.user_custom_flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_name text not null default 'My vocabulary' check (char_length(deck_name) between 1 and 80),
  hanzi text not null check (char_length(hanzi) between 1 and 120),
  pinyin text not null check (char_length(pinyin) between 1 and 160),
  translation text not null check (char_length(translation) between 1 and 240),
  example text check (example is null or char_length(example) <= 500),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_custom_flashcards_user_deck_created_idx
  on public.user_custom_flashcards (user_id, deck_name, created_at desc);

alter table public.user_custom_flashcards enable row level security;
revoke all on table public.user_custom_flashcards from public, anon;
grant select, insert, update, delete on table public.user_custom_flashcards to authenticated;

drop policy if exists "Users manage their own custom flashcards"
  on public.user_custom_flashcards;

create policy "Users manage their own custom flashcards"
  on public.user_custom_flashcards
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_user_custom_flashcards_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_custom_flashcards_updated_at
  on public.user_custom_flashcards;

create trigger user_custom_flashcards_updated_at
before update on public.user_custom_flashcards
for each row execute function public.set_user_custom_flashcards_updated_at();
