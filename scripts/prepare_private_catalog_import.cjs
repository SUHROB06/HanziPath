const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const input = path.join(root, 'public', 'vocabulary-review.json')
const defaultOutput = path.join(root, 'supabase', 'private-import', 'vocabulary')
const outputDir = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length) ?? defaultOutput
const batchSize = Number(process.argv.find(arg => arg.startsWith('--batch-size='))?.slice('--batch-size='.length) ?? 200)
const payload = JSON.parse(fs.readFileSync(input, 'utf8'))
const entries = payload.entries

if (!Array.isArray(entries) || entries.length !== payload.counts.entries) {
  throw new Error('Candidate entry count does not match its review manifest.')
}

const allowedTranslationSources = new Set([
  'Zitou', 'HanziBook', 'AI translation draft', 'AI correction draft',
])
const seen = new Set()
const rows = entries.map((entry, index) => {
  if (!entry.hanzi || !entry.pinyin || !entry.en || !entry.ru || !entry.uz) {
    throw new Error(`Entry ${index + 1} is missing Chinese, pinyin, or one of the three glosses.`)
  }
  if (entry.ruSource !== 'HearMandarin' && !allowedTranslationSources.has(entry.ruSource)) {
    throw new Error(`Unexpected Russian provenance at row ${index + 1}: ${entry.ruSource}`)
  }
  if (entry.uzSource !== 'HearMandarin' && !allowedTranslationSources.has(entry.uzSource)) {
    throw new Error(`Unexpected Uzbek provenance at row ${index + 1}: ${entry.uzSource}`)
  }
  const sourceEntryKey = `review-row-${String(index + 1).padStart(5, '0')}`
  if (seen.has(sourceEntryKey)) throw new Error(`Duplicate source entry key: ${sourceEntryKey}`)
  seen.add(sourceEntryKey)
  return {
    source_entry_key: sourceEntryKey,
    hanzi: entry.hanzi,
    traditional: entry.traditional || null,
    pinyin: entry.pinyin,
    en: entry.en,
    ru: entry.ru,
    uz: entry.uz,
    ru_source: entry.ruSource,
    uz_source: entry.uzSource,
    ru_status: entry.ruStatus,
    uz_status: entry.uzStatus,
    level20: entry.level20 == null ? null : Number(entry.level20),
    level30: entry.level30 == null ? null : String(entry.level30),
  }
})

const chunkSize = Number.isInteger(batchSize) && batchSize >= 1 ? batchSize : 200
fs.mkdirSync(outputDir, { recursive: true })
for (const name of fs.readdirSync(outputDir)) {
  if (/^entries-\d+\.sql$/.test(name)) fs.rmSync(path.join(outputDir, name))
}

const lookup = `
  select
    (select id from public.data_sources where name = 'HearMandarin HSK vocabulary dataset' limit 1) as hear_id,
    (select id from public.data_sources where name = 'Zitou Chinese Uzbek Russian vocabulary' limit 1) as zitou_id,
    (select id from public.data_sources where name = 'HanziBook HSK 3.0 Russian vocabulary' limit 1) as hanzi_book_id,
    (select id from public.data_sources where name = 'HanziPath AI-assisted translation drafts' limit 1) as ai_id`

for (let offset = 0, batch = 1; offset < rows.length; offset += chunkSize, batch += 1) {
  const chunk = rows.slice(offset, offset + chunkSize)
  const delimiter = `$catalog_${String(batch).padStart(3, '0')}$`
  const json = JSON.stringify(chunk)
  const sql = `-- Private, idempotent candidate import; all imported statuses remain unverified.
with entry as materialized (
  select *
  from jsonb_to_recordset(${delimiter}${json}${delimiter}::jsonb) as x(
    source_entry_key text, hanzi text, traditional text, pinyin text,
    en text, ru text, uz text, ru_source text, uz_source text,
    ru_status text, uz_status text, level20 integer, level30 text
  )
), source_ids as materialized (
${lookup}
), upserted_items as (
  insert into public.vocabulary_items (
    simplified, traditional, source_id, verification_status,
    review_notes, source_entry_key, notes
  )
  select e.hanzi, e.traditional, s.hear_id, 'unverified',
         'Candidate source entry; item and HSK membership remain unverified.',
         e.source_entry_key,
         'HanziPath review snapshot row; restricted staging only.'
  from entry as e cross join source_ids as s
  where s.hear_id is not null
  on conflict (source_id, source_entry_key) where source_entry_key is not null
  do update set
    simplified = excluded.simplified,
    traditional = excluded.traditional,
    verification_status = 'unverified',
    review_notes = excluded.review_notes,
    notes = excluded.notes,
    updated_at = now()
  returning id, source_id, source_entry_key
), upserted_readings as (
  insert into public.vocabulary_readings (
    vocabulary_item_id, pinyin, source_id, source_entry_key,
    verification_status, review_notes
  )
  select i.id, e.pinyin, i.source_id, e.source_entry_key,
         'unverified', 'Reading and sense alignment remain unverified.'
  from entry as e
  join upserted_items as i on i.source_entry_key = e.source_entry_key
  on conflict (vocabulary_item_id, pinyin, source_id) do update set
    source_entry_key = excluded.source_entry_key,
    verification_status = 'unverified',
    review_notes = excluded.review_notes,
    updated_at = now()
  returning id, vocabulary_item_id, pinyin, source_id
), upserted_memberships as (
  insert into public.standard_memberships (
    standard_version_id, vocabulary_item_id, source_id,
    verification_status, level_category, level_order,
    source_entry_key, source_label, review_notes
  )
  select sv.id, i.id, i.source_id, 'unverified',
         case when sv.standard_code = 'hsk30' and e.level30 = '7-9'
              then '7-9'
              else case when sv.standard_code = 'hsk20' then e.level20::text else e.level30 end
         end,
         case when sv.standard_code = 'hsk20' then e.level20
              when e.level30 = '7-9' then 7
              else e.level30::integer
         end,
         e.source_entry_key,
         'HearMandarin candidate snapshot 2026-09-09',
         'Membership remains unverified; HSK 3.0 levels 7–9 are one official band.'
  from entry as e
  join upserted_items as i on i.source_entry_key = e.source_entry_key
  join public.standard_versions as sv
    on sv.standard_code = 'hsk20'
   and sv.version_key = 'hearmandarin-candidate-2015-2026-09-09'
  where e.level20 is not null
  union all
  select sv.id, i.id, i.source_id, 'unverified',
         e.level30,
         case when e.level30 = '7-9' then 7 else e.level30::integer end,
         e.source_entry_key,
         'HearMandarin candidate snapshot 2026-09-09',
         'Membership remains unverified; HSK 3.0 levels 7–9 are one official band.'
  from entry as e
  join upserted_items as i on i.source_entry_key = e.source_entry_key
  join public.standard_versions as sv
    on sv.standard_code = 'hsk30'
   and sv.version_key = 'hearmandarin-candidate-2025-2026-09-09'
  where e.level30 is not null
  on conflict (standard_version_id, vocabulary_item_id) do update set
    level_category = excluded.level_category,
    level_order = excluded.level_order,
    verification_status = 'unverified',
    source_entry_key = excluded.source_entry_key,
    source_label = excluded.source_label,
    review_notes = excluded.review_notes
  returning id
), translation_rows as materialized (
  select e.source_entry_key, e.pinyin, e.en as translation_text,
         'en'::text as locale, 'HearMandarin'::text as source_name,
         'source_unverified'::text as entry_status
  from entry as e
  union all
  select e.source_entry_key, e.pinyin, e.ru, 'ru', e.ru_source, e.ru_status
  from entry as e
  union all
  select e.source_entry_key, e.pinyin, e.uz, 'uz', e.uz_source, e.uz_status
  from entry as e
), upserted_translations as (
  insert into public.translations (
    vocabulary_item_id, reading_id, locale, content_kind, text,
    source_id, source_entry_key, source_license_snapshot,
    verification_status, review_notes
  )
  select i.id, r.id, t.locale, 'meaning', t.translation_text,
         case
           when t.source_name = 'Zitou' then s.zitou_id
           when t.source_name = 'HanziBook' then s.hanzi_book_id
           when t.source_name in ('AI translation draft', 'AI correction draft') then s.ai_id
           else s.hear_id
         end,
         e.source_entry_key || ':' || t.locale,
         d.data_license || ' | publisher=' || d.name || ' | entry_status=' || t.entry_status || '; restricted staging only.',
         'unverified',
         'Candidate provenance=' || t.source_name || '; source status=' || t.entry_status || '; fluent-speaker review pending.'
  from translation_rows as t
  join entry as e on e.source_entry_key = t.source_entry_key
  join upserted_items as i on i.source_entry_key = e.source_entry_key
  join upserted_readings as r on r.vocabulary_item_id = i.id and r.pinyin = e.pinyin
  cross join source_ids as s
  join public.data_sources as d
    on d.id = case
      when t.source_name = 'Zitou' then s.zitou_id
      when t.source_name = 'HanziBook' then s.hanzi_book_id
      when t.source_name in ('AI translation draft', 'AI correction draft') then s.ai_id
      else s.hear_id
    end
  where nullif(btrim(t.translation_text), '') is not null
  on conflict (vocabulary_item_id, reading_id, locale, content_kind, source_id)
  do update set
    text = excluded.text,
    source_entry_key = excluded.source_entry_key,
    source_license_snapshot = excluded.source_license_snapshot,
    verification_status = 'unverified',
    review_notes = excluded.review_notes,
    updated_at = now()
  returning id
)
select
  (select count(*) from upserted_items) as items,
  (select count(*) from upserted_readings) as readings,
  (select count(*) from upserted_memberships) as memberships,
  (select count(*) from upserted_translations) as translations;
`
  fs.writeFileSync(path.join(outputDir, `entries-${String(batch).padStart(3, '0')}.sql`), sql, 'utf8')
}

console.log(JSON.stringify({ outputDir, entries: rows.length, batches: Math.ceil(rows.length / chunkSize), sourceRows: payload.attribution.length }))
