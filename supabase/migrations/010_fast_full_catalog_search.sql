-- Fast, accent-insensitive full-catalog search for HanziPath.
-- HSK 3.0 levels 7-9 are represented by the official combined 7-9 band.
create extension if not exists pg_trgm with schema extensions;

alter table public.vocabulary_readings
  add column if not exists pinyin_search text
  generated always as (
    translate(
      lower(pinyin),
      'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü',
      'aaaaeeeeiiiioooouuuuuuuuu'
    )
  ) stored;

create index if not exists vocabulary_items_simplified_trgm_idx
  on public.vocabulary_items using gin (simplified extensions.gin_trgm_ops);

create index if not exists vocabulary_items_traditional_trgm_idx
  on public.vocabulary_items using gin (traditional extensions.gin_trgm_ops)
  where traditional is not null;

create index if not exists vocabulary_readings_pinyin_search_trgm_idx
  on public.vocabulary_readings using gin (pinyin_search extensions.gin_trgm_ops);

create index if not exists translations_meaning_text_trgm_idx
  on public.translations using gin (text extensions.gin_trgm_ops)
  where content_kind = 'meaning' and verification_status <> 'rejected';
