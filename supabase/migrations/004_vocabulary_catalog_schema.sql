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
  check (rights_status <> 'approved' or (reviewed_by is not null and reviewed_at is not null)),
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
  or (nullif(btrim(reviewed_by), '') is not null and reviewed_at is not null)
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
  check (verification_status <> 'verified' or (reviewed_by is not null and reviewed_at is not null))
);

create table if not exists public.standard_memberships (
  id uuid primary key default gen_random_uuid(),
  standard_version_id uuid not null,
  vocabulary_item_id uuid not null references public.vocabulary_items(id) on delete cascade,
  source_id uuid not null references public.data_sources(id) on delete restrict,
  verification_status text not null default 'unverified'
  check (verification_status in ('unverified', 'verified', 'rejected')),
reviewed_by text,
reviewed_at timestamptz,
review_notes text,
  level_category text not null,
  level_order integer not null check (level_order between 1 and 7),
  source_entry_key text,
  source_label text,
  created_at timestamptz not null default now(),
  unique (standard_version_id, vocabulary_item_id),
  foreign key (standard_version_id, source_id)
    references public.standard_versions(id, source_id) on delete cascade,
  check (
  verification_status not in ('verified', 'rejected')
  or (nullif(btrim(reviewed_by), '') is not null and reviewed_at is not null)
)
);

create table if not exists public.examples (
  id uuid primary key default gen_random_uuid(),
  vocabulary_item_id uuid not null references public.vocabulary_items(id) on delete cascade,
  reading_id uuid,
  sentence_hanzi text not null check (length(btrim(sentence_hanzi)) > 0),
  sentence_pinyin text,
  source_id uuid not null references public.data_sources(id) on delete restrict,
  source_sentence_key text,
  source_license_snapshot text not null,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_name text,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, vocabulary_item_id),
  foreign key (reading_id, vocabulary_item_id)
    references public.vocabulary_readings(id, vocabulary_item_id) on delete set null (reading_id),
  check (verification_status <> 'verified' or (reviewed_at is not null and (reviewer_id is not null or reviewer_name is not null)))
);

create table if not exists public.translations (
  id uuid primary key default gen_random_uuid(),
  vocabulary_item_id uuid not null references public.vocabulary_items(id) on delete cascade,
  reading_id uuid,
  example_id uuid,
  locale text not null check (locale in ('en', 'ru', 'uz')),
  content_kind text not null check (content_kind in ('meaning', 'example_translation')),
  text text not null check (length(btrim(text)) > 0),
  source_id uuid not null references public.data_sources(id) on delete restrict,
  source_entry_key text,
  source_license_snapshot text not null,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_name text,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (reading_id, vocabulary_item_id)
    references public.vocabulary_readings(id, vocabulary_item_id) on delete set null (reading_id),
  foreign key (example_id, vocabulary_item_id)
    references public.examples(id, vocabulary_item_id) on delete cascade,
  check (
    (content_kind = 'meaning' and example_id is null)
    or (content_kind = 'example_translation' and example_id is not null)
  ),
  check (verification_status <> 'verified' or (reviewed_at is not null and (reviewer_id is not null or reviewer_name is not null)))
);

-- Enforce that a catalog membership is explicitly valid for its own standard.
-- HSK 3.0's 2025 advanced vocabulary remains a single 7-9 category.
create or replace function public.validate_standard_membership_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  membership_standard text;
begin
  select sv.standard_code into membership_standard
  from public.standard_versions as sv
  where sv.id = new.standard_version_id
    and sv.source_id = new.source_id;

  if not found then
    raise exception 'Membership source must match its standard version source';
  end if;

  if membership_standard = 'hsk20' then
    if new.level_category not in ('1', '2', '3', '4', '5', '6')
      or new.level_order <> new.level_category::integer then
      raise exception 'HSK 2.0 category and level order must match levels 1-6';
    end if;
  elsif membership_standard = 'hsk30' then
    if new.level_category in ('1', '2', '3', '4', '5', '6') then
      if new.level_order <> new.level_category::integer then
        raise exception 'HSK 3.0 category and level order must match levels 1-6';
      end if;
    elsif new.level_category = '7-9' then
      if new.level_order <> 7 then
        raise exception 'HSK 3.0 category 7-9 must have level order 7';
      end if;
    else
      raise exception 'HSK 3.0 categories must be levels 1-6 or 7-9';
    end if;
  else
    raise exception 'Unknown standard version';
  end if;
  return new;
end;
$$;

drop trigger if exists standard_membership_category_check on public.standard_memberships;
create trigger standard_membership_category_check
before insert or update of standard_version_id, source_id, level_category, level_order
on public.standard_memberships
for each row execute function public.validate_standard_membership_category();

create index if not exists standard_versions_source_idx on public.standard_versions(source_id);
create index if not exists vocabulary_items_hanzi_idx on public.vocabulary_items(simplified);
create index if not exists vocabulary_items_source_idx on public.vocabulary_items(source_id);
create index if not exists vocabulary_items_source_key_uidx
  on public.vocabulary_items(source_id, source_entry_key) where source_entry_key is not null;
create index if not exists vocabulary_readings_pinyin_idx on public.vocabulary_readings(pinyin);
create index if not exists vocabulary_readings_item_idx on public.vocabulary_readings(vocabulary_item_id);
create index if not exists vocabulary_readings_source_key_uidx
  on public.vocabulary_readings(source_id, source_entry_key) where source_entry_key is not null;
create index if not exists standard_memberships_version_level_idx on public.standard_memberships(standard_version_id, level_order, vocabulary_item_id);
create index if not exists standard_memberships_item_idx on public.standard_memberships(vocabulary_item_id);
create index if not exists standard_memberships_source_key_uidx
  on public.standard_memberships(standard_version_id, level_category, source_entry_key)
  where source_entry_key is not null;
create index if not exists translations_locale_status_idx on public.translations(locale, verification_status, vocabulary_item_id);
create index if not exists translations_source_idx on public.translations(source_id);
create index if not exists translations_source_key_uidx
  on public.translations (
    vocabulary_item_id,
    coalesce(reading_id, '00000000-0000-0000-0000-000000000000'::uuid),
    locale,
    content_kind,
    source_id,
    coalesce(example_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source_entry_key
  ) where source_entry_key is not null;
create index if not exists examples_item_idx on public.examples(vocabulary_item_id);
create index if not exists examples_source_idx on public.examples(source_id);
create index if not exists examples_source_key_uidx
  on public.examples(vocabulary_item_id, source_id, source_sentence_key)
  where source_sentence_key is not null;

alter table public.data_sources enable row level security;
alter table public.standard_versions enable row level security;
alter table public.vocabulary_items enable row level security;
alter table public.vocabulary_readings enable row level security;
alter table public.standard_memberships enable row level security;
alter table public.translations enable row level security;
alter table public.examples enable row level security;

-- Only approved, publishable sources and their dependent content are visible to
-- public/regular authenticated clients. No client-facing write policies exist.
drop policy if exists "Published sources are readable" on public.data_sources;
create policy "Published sources are readable"
  on public.data_sources for select to anon, authenticated
  using (rights_status = 'approved' and is_publishable);

drop policy if exists "Published standard versions are readable" on public.standard_versions;
create policy "Published standard versions are readable"
  on public.standard_versions for select to anon, authenticated
  using (exists (
    select 1 from public.data_sources as s
    where s.id = standard_versions.source_id
      and s.rights_status = 'approved' and s.is_publishable
  ));

drop policy if exists "Published vocabulary items are readable" on public.vocabulary_items;
create policy "Published vocabulary items are readable"
  on public.vocabulary_items for select to anon, authenticated
  using (exists (
    select 1 from public.data_sources as s
    where s.id = vocabulary_items.source_id
      and s.rights_status = 'approved' and s.is_publishable
 ) and verification_status = 'verified');

drop policy if exists "Published readings are readable" on public.vocabulary_readings;
create policy "Published readings are readable"
  on public.vocabulary_readings for select to anon, authenticated
  using (
      verification_status = 'verified'
    and
    exists (
      select 1 from public.data_sources as s
      where s.id = vocabulary_readings.source_id
        and s.rights_status = 'approved' and s.is_publishable
    )
    and exists (
      select 1 from public.vocabulary_items as v
      join public.data_sources as item_source on item_source.id = v.source_id
      where v.id = vocabulary_readings.vocabulary_item_id
        and item_source.rights_status = 'approved' and item_source.is_publishable
    )
  );

drop policy if exists "Published memberships are readable" on public.standard_memberships;
create policy "Published memberships are readable"
  on public.standard_memberships for select to anon, authenticated
  using (
  verification_status = 'verified'
and
    exists (
      select 1 from public.data_sources as s
      where s.id = standard_memberships.source_id
        and s.rights_status = 'approved' and s.is_publishable
    )
    and exists (
      select 1 from public.standard_versions as sv
      join public.data_sources as standard_source on standard_source.id = sv.source_id
      where sv.id = standard_memberships.standard_version_id
        and standard_source.rights_status = 'approved' and standard_source.is_publishable
    )
    and exists (
      select 1 from public.vocabulary_items as v
      join public.data_sources as item_source on item_source.id = v.source_id
      where v.id = standard_memberships.vocabulary_item_id
        and item_source.rights_status = 'approved' and item_source.is_publishable
    )
  );

drop policy if exists "Published translations are readable" on public.translations;
create policy "Published translations are readable"
  on public.translations for select to anon, authenticated
  using (
    verification_status = 'verified'
    and exists (
      select 1 from public.data_sources as s
      where s.id = translations.source_id
        and s.rights_status = 'approved' and s.is_publishable
    )
    and exists (
      select 1 from public.vocabulary_items as v
      join public.data_sources as item_source on item_source.id = v.source_id
      where v.id = translations.vocabulary_item_id
        and item_source.rights_status = 'approved' and item_source.is_publishable
    )
    and (
      translations.reading_id is null or exists (
        select 1 from public.vocabulary_readings as r
        join public.data_sources as reading_source on reading_source.id = r.source_id
        where r.id = translations.reading_id
          and r.vocabulary_item_id = translations.vocabulary_item_id
          and r.verification_status = 'verified'
          and reading_source.rights_status = 'approved' and reading_source.is_publishable
      )
    )
    and (
      translations.example_id is null or exists (
        select 1 from public.examples as e
        join public.data_sources as example_source on example_source.id = e.source_id
        where e.id = translations.example_id
          and e.vocabulary_item_id = translations.vocabulary_item_id
          and e.verification_status = 'verified'
          and example_source.rights_status = 'approved' and example_source.is_publishable
      )
    )
  );

drop policy if exists "Published examples are readable" on public.examples;
create policy "Published examples are readable"
  on public.examples for select to anon, authenticated
  using (
    verification_status = 'verified'
    and exists (
      select 1 from public.data_sources as s
      where s.id = examples.source_id
        and s.rights_status = 'approved' and s.is_publishable
    )
    and exists (
      select 1 from public.vocabulary_items as v
      join public.data_sources as item_source on item_source.id = v.source_id
      where v.id = examples.vocabulary_item_id
        and item_source.rights_status = 'approved' and item_source.is_publishable
    )
    and (
      examples.reading_id is null or exists (
        select 1 from public.vocabulary_readings as r
        join public.data_sources as reading_source on reading_source.id = r.source_id
        where r.id = examples.reading_id
          and r.vocabulary_item_id = examples.vocabulary_item_id
          and r.verification_status = 'verified'
          and reading_source.rights_status = 'approved' and reading_source.is_publishable
      )
    )
  );

-- Reset table privileges so inherited/pre-existing grants cannot grant writes;
-- public roles receive only SELECT, still subject to the policies above.
revoke all privileges on table public.data_sources, public.standard_versions,
  public.vocabulary_items, public.vocabulary_readings, public.standard_memberships,
  public.translations, public.examples from anon, authenticated;
grant select on table public.data_sources, public.standard_versions,
  public.vocabulary_items, public.vocabulary_readings, public.standard_memberships,
  public.translations, public.examples to anon, authenticated;

comment on table public.standard_versions is 'Versioned exam/proficiency standards. HSK 2.0 and HSK 3.0 membership is stored independently.';
comment on table public.standard_memberships is 'Explicit membership assignment for a vocabulary item in exactly one standard version.';
comment on column public.standard_memberships.level_category is 'For HSK 3.0 November 2025, the advanced band is stored as the single category 7-9.';
comment on table public.translations is 'Translation content with data-source, license, verification, and reviewer provenance. Example translations reference one specific example.';
comment on table public.examples is 'Example sentences with source-license and review provenance; sentence translations are stored in translations.';
