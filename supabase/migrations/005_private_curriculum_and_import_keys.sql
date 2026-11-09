-- Additive curriculum storage and idempotent import keys.
-- Existing vocabulary/progress tables and rows are left unchanged.
-- Candidate sources and content stay non-publishable until rights and review are approved.

create unique index if not exists data_sources_name_url_uidx
  on public.data_sources (name, source_url);

create unique index if not exists vocabulary_items_source_entry_uidx
  on public.vocabulary_items (source_id, source_entry_key)
  where source_entry_key is not null;

create unique index if not exists translations_catalog_entry_uidx
  on public.translations (
    vocabulary_item_id,
    reading_id,
    locale,
    content_kind,
    source_id
  ) nulls not distinct;

create table if not exists public.curriculum_lessons (
  lesson_key text primary key,
  standard_code text not null check (standard_code in ('hsk20', 'hsk30')),
  course_level smallint not null check (course_level between 1 and 9),
  level_category text not null,
  chapter_order integer not null check (chapter_order > 0),
  lesson_part integer not null check (lesson_part > 0),
  title text not null check (length(btrim(title)) > 0),
  keywords text[] not null default '{}',
  grammar jsonb not null,
  duration_minutes smallint not null check (duration_minutes between 1 and 180),
  source_id uuid not null references public.data_sources(id) on delete restrict,
  is_publishable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (standard_code, course_level, chapter_order, lesson_part),
  check (
    (standard_code = 'hsk20' and course_level <= 6 and level_category = course_level::text)
    or (standard_code = 'hsk30' and course_level <= 6 and level_category = course_level::text)
    or (standard_code = 'hsk30' and course_level between 7 and 9 and level_category = '7-9')
  ),
  check (not is_publishable or source_id is not null)
);

comment on table public.curriculum_lessons is
  'Original HanziPath lesson plans. For HSK 3.0, course stages 7/8/9 map to the single official 7-9 band.';

create table if not exists public.course_exam_blueprints (
  exam_key text primary key,
  standard_code text not null check (standard_code in ('hsk20', 'hsk30')),
  level_category text not null,
  section_counts jsonb not null,
  section_parts jsonb not null,
  duration_minutes smallint not null check (duration_minutes between 1 and 360),
  is_combined_band boolean not null default false,
  assessment_note text not null,
  source_id uuid not null references public.data_sources(id) on delete restrict,
  is_publishable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (standard_code, level_category),
  check (
    (standard_code = 'hsk30' and level_category = '7-9' and is_combined_band)
    or (level_category <> '7-9' and not is_combined_band)
  )
);

comment on table public.course_exam_blueprints is
  'Original HanziPath practice exam blueprints. They reflect public section counts and are not official exam papers.';

alter table public.curriculum_lessons enable row level security;
alter table public.course_exam_blueprints enable row level security;

revoke all on public.curriculum_lessons from anon, authenticated;
revoke all on public.course_exam_blueprints from anon, authenticated;
grant select on public.curriculum_lessons to anon, authenticated;
grant select on public.course_exam_blueprints to anon, authenticated;

drop policy if exists "Approved curriculum lessons are readable" on public.curriculum_lessons;
create policy "Approved curriculum lessons are readable"
  on public.curriculum_lessons for select to anon, authenticated
  using (
    is_publishable
    and exists (
      select 1 from public.data_sources as s
      where s.id = curriculum_lessons.source_id
        and s.rights_status = 'approved'
        and s.is_publishable
    )
  );

drop policy if exists "Approved exam blueprints are readable" on public.course_exam_blueprints;
create policy "Approved exam blueprints are readable"
  on public.course_exam_blueprints for select to anon, authenticated
  using (
    is_publishable
    and exists (
      select 1 from public.data_sources as s
      where s.id = course_exam_blueprints.source_id
        and s.rights_status = 'approved'
        and s.is_publishable
    )
  );
