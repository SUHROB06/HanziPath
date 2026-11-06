# Vocabulary data sources and import status

Reviewed 2026-11-06.

## Current product state

- The app contains eight demo entries. They are not a complete HSK list.
- Migration `004_vocabulary_catalog_schema.sql` defines an empty catalog; it contains no vocabulary rows.
- Public catalog access requires an approved, publishable source and verified content. The app continues to use demo entries when there is no approved catalog.
- No database write, vocabulary import, merge, or deployment was performed for this review.

## Candidate HSK source

**HearMandarin HSK 3.0 Word List Dataset**

- Dataset: <https://hearmandarin.com/datasets/>
- Source notes: <https://hearmandarin.com/data-sources/>
- Declared license: CC BY 4.0
- Attribution requested by publisher: `HearMandarin (https://hearmandarin.com)`
- Declared upstream: official 2025 HSK exam syllabus and 2015 HSK 2.0 list.
- Retrieved file: `hsk-3-0-words.csv`, publisher version 2026-09-09, generated 2026-09-28.
- Observed file coverage: 11,147 unique rows, including 11,000 HSK 3.0 memberships and 5,000 HSK 2.0 memberships. A row can belong to both standards.
- Fields include simplified/traditional forms, pinyin, POS, English gloss, and level membership. No Russian or Uzbek values and no example sentences are included.

## Candidate Russian/Uzbek translations

**HSK Chinese–Uzbek–Russian Vocabulary (Zitou)**

- Dataset: <https://huggingface.co/datasets/Maqsudjonpolatov/hsk-chinese-uzbek-russian>
- Dataset card and provenance: <https://huggingface.co/datasets/Maqsudjonpolatov/hsk-chinese-uzbek-russian/blob/main/README.md>
- Declared license: CC BY 4.0
- Required attribution: `Zitou (zitou.app)`
- The author says Russian and Uzbek glosses were written with AI assistance and are corrected over time from learner feedback; rare senses may contain errors.
- Downloaded CSV has 8,296 records with simplified/traditional forms, pinyin, Russian and Uzbek meanings, and HSK 2.0, HSK 3.0 (2021), and HSK 2025 level fields.
- The dataset card says the Russian/Uzbek glosses are Zitou's work; HSK membership, traditional forms, and frequency data come from `complete-hsk-vocabulary` (MIT). English glosses and example sentences are absent.

## Coverage comparison

Matching the Zitou CSV to the full HearMandarin candidate by simplified headword yielded:

- 7,297 of 11,147 rows with both Russian and Uzbek values.
- 3,850 rows without a matched Russian/Uzbek record.
- For HSK 2.0, 4,891 matched rows and 109 gaps.
- For the 2025 HSK 3.0 exam list, 7,167 matched rows and 3,833 gaps.

The bilingual candidate is therefore not a complete translation set. It has no examples. Any new AI-generated translations would need explicit `unverified` status and later human review.

## Rights decision

The third-party dataset publishers declare open licenses and provide attribution/source notes. The Chinese Testing International website also publishes terms restricting reuse of its website content. The chain of rights for the official HSK lists has not been independently confirmed for HanziPath. Keep the corresponding `data_sources.rights_status` at `pending` and `is_publishable` false until that question is resolved. Do not import these files as approved or expose them through the public catalog yet.

## Import gate

Before preparing a production import, record for every source:

1. Exact dataset version and source URL.
2. The applicable license and required attribution.
3. Which columns come from which source; do not attribute English glosses, Russian/Uzbek meanings, or examples to the official HSK syllabus unless it actually supplies them.
4. Written confirmation or other adequate evidence that the publisher can license the underlying HSK list for the intended use.
5. Human review status for translations, readings, levels, and all example content.

After these checks, prepare a separate import artifact and review it before any database operation. Never apply a seed/import file to production as part of this workflow.
