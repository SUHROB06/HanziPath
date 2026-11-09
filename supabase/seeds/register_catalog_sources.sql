-- Register all sources before importing their entries. Every source remains
-- pending and non-publishable until a separate rights/review decision is made.
insert into public.data_sources (
  name, source_url, source_version, data_license, license_url,
  attribution_text, share_alike, rights_status, is_publishable, rights_review_notes
)
values
  (
    'HearMandarin HSK vocabulary dataset',
    'https://hearmandarin.com/datasets/',
    '2026-09-09 snapshot; 2015 HSK 2.0 and 2025 HSK 3.0 lists',
    'CC BY 4.0 (publisher-declared); underlying CTI list rights are still under review',
    'https://creativecommons.org/licenses/by/4.0/',
    'HearMandarin (https://hearmandarin.com); adapted vocabulary candidates; CTI is not an endorser.',
    false, 'pending', false,
    'The exact third-party dataset declares CC BY 4.0. Keep private until the underlying HSK list rights and list membership are reviewed.'
  ),
  (
    'Zitou Chinese Uzbek Russian vocabulary',
    'https://huggingface.co/datasets/Maqsudjonpolatov/hsk-chinese-uzbek-russian',
    'Publisher dataset snapshot used in the candidate bundle',
    'CC BY 4.0 (publisher-declared); translations are unverified',
    'https://creativecommons.org/licenses/by/4.0/',
    'Zitou (zitou.app); meanings may contain AI-assisted content and require fluent-speaker review.',
    false, 'pending', false,
    'Publisher declares CC BY 4.0. Source glosses and reading matches are not verified for this project.'
  ),
  (
    'HanziBook HSK 3.0 Russian vocabulary',
    'https://hanzibook.com/ru/hsk-3-0',
    'Publisher snapshot used for Russian fallbacks',
    'CC BY-SA 4.0 (publisher-declared; includes CC-CEDICT attribution requirements)',
    'https://creativecommons.org/licenses/by-sa/4.0/',
    'HanziBook (https://hanzibook.com) and CC-CEDICT; adapted meanings remain CC BY-SA 4.0.',
    true, 'pending', false,
    'Publisher declares CC BY-SA 4.0. Russian senses and source reading matches require review.'
  ),
  (
    'HanziPath AI-assisted translation drafts',
    'https://github.com/SUHROB06/HanziPath',
    'Vocabulary candidate bundle assembled 2026-11-08',
    'Internal project draft; publication terms pending owner review',
    null,
    'HanziPath project draft; not externally sourced; Russian and Uzbek meanings require fluent-speaker review.',
    false, 'pending', false,
    'AI-assisted translation and correction drafts. Never present as verified or trusted before human review.'
  ),
  (
    'HanziPath original curriculum',
    'https://github.com/SUHROB06/HanziPath',
    'Original course draft 2026-11-09',
    'Project original content; distribution terms pending owner review',
    null,
    'HanziPath original lessons and practice blueprints; not official CTI exam material.',
    false, 'pending', false,
    'New prose, examples, grammar notes, lesson themes, and mock-exam prompts authored for HanziPath. Publishing terms need owner review.'
  )
on conflict (name, source_url) do update set
  source_version = excluded.source_version,
  data_license = excluded.data_license,
  license_url = excluded.license_url,
  attribution_text = excluded.attribution_text,
  share_alike = excluded.share_alike,
  rights_status = 'pending',
  is_publishable = false,
  rights_review_notes = excluded.rights_review_notes,
  updated_at = now();

insert into public.standard_versions (
  standard_code, version_key, display_name, published_at, effective_at, source_id
)
select
  candidates.standard_code,
  candidates.version_key,
  candidates.display_name,
  candidates.published_at,
  candidates.effective_at,
  source.id
from (values
  (
    'hsk20'::text,
    'hearmandarin-candidate-2015-2026-09-09'::text,
    'HSK 2.0 — six levels (candidate snapshot)'::text,
    '2015-01-01'::date,
    '2015-01-01'::date
  ),
  (
    'hsk30'::text,
    'hearmandarin-candidate-2025-2026-09-09'::text,
    'HSK 3.0 — levels 1–6 and combined 7–9 band (candidate snapshot)'::text,
    '2025-11-01'::date,
    '2025-11-01'::date
  )
) as candidates(standard_code, version_key, display_name, published_at, effective_at)
join public.data_sources as source
  on source.name = 'HearMandarin HSK vocabulary dataset'
  and source.source_url = 'https://hearmandarin.com/datasets/'
on conflict (standard_code, version_key) do update set
  display_name = excluded.display_name,
  published_at = excluded.published_at,
  effective_at = excluded.effective_at,
  source_id = excluded.source_id,
  updated_at = now();

update public.standard_versions
set display_name = 'HSK 3.0 — levels 1–6 and combined 7–9 band',
    updated_at = now()
where standard_code = 'hsk30'
  and version_key = '2025-11-syllabus'
  and display_name = 'HSK 3.0 — Three Stages, Nine Levels';
