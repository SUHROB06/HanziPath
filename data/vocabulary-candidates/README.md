# HSK vocabulary candidate files

These review files are included on the `feature/vocabulary-database` branch and in its review build. The corresponding catalog has already been imported into the separate `HanziPath-Test` Supabase staging project. The catalog's `rights_status` stays `pending`, and every English/Russian/Uzbek meaning and HSK membership remains `unverified`. Branch visibility is for inspection and does not mean rights or translations are approved for `main` or production.

## Files

- `hsk20-hsk30-2025-candidate.csv`: one row per Chinese headword/reading, with both HSK 2.0 (2015) and HSK 3.0 (2025) memberships where present. The official combined HSK 7–9 band remains `7-9`; this file does not invent separate levels.
- `translation-backlog.csv`: one row for every currently blank Russian or Uzbek field.
- `translation-review-queue.csv`: the 3,850 rows with at least one AI-assisted draft or correction, ready for fluent-speaker review.
- `source-snapshot-manifest.json`: snapshot checksums, output checksum and row counts.
- `source-snapshots/`: the original downloaded files used to produce this candidate.
- `../../scripts/assemble_vocabulary_candidates.py`: reproducible local assembly. It only reads files and writes candidate CSV/JSON files; it does not run SQL or connect to Supabase.

All 11,147 candidate rows now have English, Russian and Uzbek fields populated, covering 5,000 HSK 2.0 memberships and 11,000 HSK 3.0 (2025) memberships. `translation-backlog.csv` currently contains only its header. The generator reports 3,590 Russian and 3,850 Uzbek `ai_draft_unverified` fields, including explicit correction drafts for conflicting source meanings. `translation-review-queue.csv` collects the 3,850 rows that need fluent-speaker review. All external source values also remain unverified. Same-character matches with a different pinyin remain marked for reading review.

## Attribution and licenses

- **English glosses, pinyin, traditional forms and list membership:** [HearMandarin HSK 3.0 Word List Dataset](https://hearmandarin.com/datasets/), snapshot metadata version `2026-09-09`, CC BY 4.0. Credit: `HearMandarin (https://hearmandarin.com)`.
- **Russian and Uzbek glosses:** [Zitou HSK Chinese–Uzbek–Russian Vocabulary](https://huggingface.co/datasets/Maqsudjonpolatov/hsk-chinese-uzbek-russian), CC BY 4.0. Credit: `Zitou (zitou.app)`.
- **Additional Russian glosses:** [HanziBook HSK 3.0 Russian list](https://hanzibook.com/ru/hsk-3-0), CC BY-SA 4.0. Credit HanziBook and CC-CEDICT; any adapted dataset incorporating these meanings must preserve CC BY-SA 4.0.
- **Draft translations:** original AI-assisted drafts from the English teaching glosses; unverified and provided only for human review.

The feature-branch review build copies these fields into `public/vocabulary-review.json` so the complete set can be inspected. This does not mark the database source approved, nor does it mean the translations or memberships have passed review. The source licenses and attribution are shown in the app and below. CTI's [website terms](https://admin.chinesetest.cn/userregister/protocol_en.jsp) separately restrict reuse of CTI website content; the upstream-rights question for the official lists remains unresolved for HanziPath. The user has directed that the candidate package be shared on this feature branch without waiting for written clarification. Keep it marked for review; do not represent it as verified or promote it to `main`/production until the rights question is resolved and a human reviewer checks the translations. The combined adapted data file is provisionally marked CC BY-SA 4.0 because it includes HanziBook/CC-CEDICT-derived material.
