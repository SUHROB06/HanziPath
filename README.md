# HanziPath — 汉字之路

A responsive React + Vite starter for a Chinese-learning platform supporting HSK 2.0 and HSK 3.0, with Russian, English, and Uzbek Latin interface languages.

## Included
- Russian / English / Uzbek Latin interface language selector
- Centralized translation keys for interface copy
- Guest language preference saved locally; signed-in preference is prepared through the Supabase `user_preferences` table
- HSK 2.0 and HSK 3.0 selector, vocabulary search, and level filters
- Sample vocabulary in the public dictionary while the full candidate catalog remains private for review
- 464 original HanziPath lesson words across nine course stages, used in lesson word sets, cards, and listening practice
- Search by characters, pinyin, or meaning; filter by standard and level; browse 60 entries per page
- 132 original HSK 2.0 lessons across levels 1–6
- 270 original HSK 3.0 lessons across learning stages 1–9; stages 7–9 stay inside the official combined 7–9 vocabulary band
- Every lesson has a level-specific new-word set, flashcards, a spoken example, listening choices, and an original grammar focus
- 13 original timed practice-exam blueprints: HSK 2.0 levels 1–6, HSK 3.0 levels 1–6, and one combined HSK 3.0 levels 7–9 practice exam
- Browser pronunciation, listening practice, lesson completion, and exam scoring
- Local study progress, learned-word marks, checklist, and streak saved in browser storage
- Uzbek vocabulary and example translation fields with per-translation source and verification metadata
- Daily checklist and starter dashboard
- Supabase schema for vocabulary, grammar, exercises, spaced-repetition progress, and daily activity
- Demo mode without Supabase credentials

**Vocabulary note:** The public dictionary contains 8 sample entries; it is not a complete HSK dictionary. The lessons use 464 original HanziPath words across nine course stages. These course stages are an in-house learning sequence, not verified HSK memberships, and the RU/EN/UZ glosses are editorial drafts awaiting review. A local review build can separately load `public/vocabulary-review.json`, a private 11,147-entry candidate dataset. It is not a human-verified official dictionary: translations and HSK membership remain unverified. Candidate records exist only in the separate `HanziPath-Test` Supabase staging project; every source is pending, every record is unverified, and RLS blocks public reads. The review JSON is ignored by Git. Do not publish that dataset until rights review and human translation review are complete.

## Run locally
Requires Node.js 20 or newer.

```bash
npm install
npm run dev
npm run build
```

## Connect Supabase
1. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your local environment.
2. Apply `001_initial_schema.sql` to a new Supabase project if the initial schema is not already present.
3. Apply `002_uzbek_localization.sql` to add nullable Uzbek translation/example fields, verification metadata, and the RLS-protected language preference table.
4. Apply `003_uzbek_translation_metadata.sql` to document the source and verification requirements for Uzbek text.
5. Apply `supabase/migrations/004_vocabulary_catalog_schema.sql` only after reviewing the target database and confirming the migration has not already been applied.
6. Apply `supabase/migrations/005_private_curriculum_and_import_keys.sql` to add private curriculum storage and idempotent catalog keys.
7. Restart the dev server.

The migration is additive. It does not import vocabulary, alter HSK 2.0 records, or delete or rewrite user progress. Never put a Supabase service-role key in frontend code; use only the anon/publishable key.

Migration `004` creates a separate, provenance-aware vocabulary catalog. Migration `005` adds original lesson and practice-exam storage. Neither changes the legacy vocabulary tables. Public catalog reads require an approved, publishable data source and verified content. Current HanziPath-Test records remain private until those gates are completed.

## Vocabulary data status

The local review UI loads candidate entries from `public/vocabulary-review.json`; they are not part of the public Git build or a public catalog. Candidate records are staged only in the separate `HanziPath-Test` Supabase project. The source remains pending rights review, and translations and HSK membership remain unverified. See [`VOCABULARY_DATA_SOURCES.md`](VOCABULARY_DATA_SOURCES.md) and [`data/vocabulary-candidates/README.md`](data/vocabulary-candidates/README.md) for source notices, coverage gaps, attribution, and release conditions.

The full review dictionary has no example sentence for most entries. Course grammar examples are newly written and do not reproduce the supplied textbooks. Practice exams are original exercises that mirror the HSK 2.0 question and section counts and section time limits; they are not official papers. Listening uses browser speech synthesis, and reading task types are simplified. The HSK 4 picture-writing task is represented as a text prompt. CTI's [HSK structure table](https://www.chinesetest.cn/userfiles/file/HSKbyWord.pdf) lists section time separately from the five-minute personal-information period. The dataset uses the 2025 HSK 3.0 list snapshot; CTI currently announces a global HSK 3.0 launch date of December 13, 2026. When approved catalog versions exist, the app selects the most recently effective or published standard version.

Profile language persistence requires a signed-in Supabase user. The current starter does not provide sign-in/sign-up flows; guests can always persist their choice in browser local storage.

## Publish
Import the existing repository into your hosting provider and configure the same two `VITE_SUPABASE_*` variables in its environment settings.
