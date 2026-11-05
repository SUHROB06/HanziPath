-- Additive vocabulary catalog foundation. This migration does not alter the legacy
-- public.vocabulary or public.user_progress tables and imports no vocabulary.

create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_url text not null,
  source_version text,
  data_license text not null,
  license_url text,
  attribution_text text not null,
  share_alike boolean not null default false,
  rights_status text not null default 'pending'
    check (rights_status in ('pending', 'approved', 'restricted')),
  is_publishable boolean not null default false,
  rights_review_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    rights_status <> 'approved'
    or (nullif(btrim(reviewed_by), '') is not null and reviewed_at is not null)
  ),
  check (not is_publishable or rights_status = 'approved')
);

create table if not exists public.standard_versions (
  id uuid primary key default gen_random_uuid(),
  standard_code text not null check (standard_code in ('hsk20', 'hsk30')),
  version_key text not null,
  display_name text not null,
  published_at date,
  effective_at date,
  source_id uuid not null references public.data_sources(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (standard_code, version_key),
  unique (id, standard_code),
  unique (id, source_id)
);

create table if not exists public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  simplified text not null check (length(btrim(simplified)) > 0),
  traditional text,
  source_id uuid not null references public.data_sources(id) on delete restrict,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  source_entry_key text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, source_id),
  check (
    verification_status not in ('verified', 'rejected')
    or (
      nullif(btrim(reviewed_by), '') is not null
      and reviewed_at is not null
    )
  )
);

create table if not exists public.vocabulary_readings (
  id uuid primary key default gen_random_uuid(),
  vocabulary_item_id uuid not null references public.vocabulary_items(id) on delete cascade,
  pinyin text not null check (length(btrim(pinyin)) > 0),
  pinyin_numeric text,
  part_of_speech text,
  source_id uuid not null references public.data_sources(id) on delete restrict,
  source_entry_key text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vocabulary_item_id, pinyin, source_id),
  unique (id, vocabulary_item_id),
  check (
    verification_status not in ('verified', 'rejected')
    or (
      nullif(btrim(reviewed_by), '') is not null
      and reviewed_at is not null
    )
  )
);

create table if not exists public.standard_memberships (
  id uuid primary key default gen_random_uuid(),
  standard_version_id uuid not null,
  vocabulary_item_id uuid not null references public.vocabulary_items(id) on delete cascade,
