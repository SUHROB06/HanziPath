# Vocabulary source audit and candidate status

Reviewed 2026-11-09. Work is on `feature/vocabulary-database`; the staging import targets only the Supabase project `HanziPath-Test` (`qnwdspjwecrgjucvyqew`).

## What has been prepared

- `data/vocabulary-candidates/hsk20-hsk30-2025-candidate.csv` contains 11,147 source entries. The 5,000 HSK 2.0 memberships and 11,000 HSK 3.0 (2025 syllabus) memberships overlap; the file keeps one row per source headword/reading and records both memberships.
- English teaching glosses are present for all 11,147 source entries.
- All 11,147 candidate rows now have English, Russian, and Uzbek fields populated. The HSK 2.0 list has 5,000 memberships; the 2025 HSK 3.0 list has 11,000, including the combined 7–9 band.
- The generator reports 3,590 Russian and 3,850 Uzbek `ai_draft_unverified` fields. These include translations drafted from English glosses and explicit correction drafts for source mismatches. Every draft requires fluent-speaker review.
- `translation-backlog.csv` currently contains only its header: no Russian or Uzbek fields are blank. Existing source values, headword-only matches and generated drafts are still unverified.
- `data/vocabulary-candidates/translation-review-queue.csv` contains the 3,850 rows with at least one generated draft for a fluent reviewer.
- The local review build now loads `public/vocabulary-review.json` (11,147 entries) with source notices, all three meaning fields, and pagination. It is a review dataset, not the approved Supabase catalog. Every Russian/Uzbek draft and every HSK membership remains unverified.
- Pinyin-exact source matches are preferred. A same-headword match with a different pinyin is retained only with a reading-review status and note.
- A restricted staging import is now in `HanziPath-Test`: 11,147 vocabulary entries, 11,147 readings, 16,000 standard memberships, and 33,441 meaning translations (11,147 each in English, Russian, and Uzbek). All source rights are `pending`, all entries and translations are `unverified`, and every source is non-publishable. RLS keeps these records from public catalog reads.
- The same staging project contains 402 original lesson records and 13 original mock-exam blueprints. They are non-publishable until project release terms are reviewed. Lessons include HSK 2.0 levels 1–6 and HSK 3.0 learning stages 1–9; stages 7–9 map to one official combined 7–9 band.
- The candidate review JSON and generated import batches are kept out of Git by ignore rules. No `main` change, merge, pull request or deployment was made. The local branch has not been pushed during this step.

The HSK 3.0 advanced band is recorded as `7-9`, as published. It is not split into invented 7, 8 and 9 lists.

## Source files and published rights

### English glosses, Chinese forms, readings and HSK memberships

**HearMandarin HSK 3.0 Word List Dataset**

- Dataset and license: <https://hearmandarin.com/datasets/>
- Source detail and file history: <https://hearmandarin.com/data-sources/>
- Snapshot metadata version: `2026-09-09`; file generated 2026-09-28.
- Publisher declares CC BY 4.0, including commercial use with credit: `HearMandarin (https://hearmandarin.com)`.
- The source describes 11,147 rows, built from the 2025 HSK 3.0 exam syllabus and 2015 HSK 2.0 list. Its English glosses are written or reviewed in-house, not copied from CC-CEDICT.
- Snapshot: `data/vocabulary-candidates/source-snapshots/hearmandarin-hsk-2025-and-2015.json`.

### Russian and Uzbek glosses

**Zitou HSK Chinese–Uzbek–Russian Vocabulary**

- Dataset and card: <https://huggingface.co/datasets/Maqsudjonpolatov/hsk-chinese-uzbek-russian>
- Publisher declares CC BY 4.0; required credit: `Zitou (zitou.app)`.
- The publisher says meanings were written with AI assistance and corrected from learner feedback over time. Rare-sense errors are possible.
- Snapshot: `data/vocabulary-candidates/source-snapshots/zitou-hsk-uz-ru.csv`.

### Additional Russian glosses

**HanziBook HSK 3.0 Russian list**

- Dataset description and attribution: <https://hanzibook.com/en/guide/hsk-3-0-anki-deck>
- Russian download page: <https://hanzibook.com/ru/hsk-3-0>
- Publisher declares CC BY-SA 4.0 for the files. The Russian file contains English fallbacks in upper levels; the candidate assembly uses only values containing Russian Cyrillic characters.
- Attribution must credit HanziBook and CC-CEDICT; adaptations of the meanings must remain CC BY-SA 4.0.
- Snapshot: `data/vocabulary-candidates/source-snapshots/hanzibook-hsk2025-ru.csv`.

### Draft translations

The gap-filling meanings were drafted from English glosses for this project. They are original AI-assisted drafts, not copied from an external translation source. They are marked `ai_draft_unverified` and need review by fluent Russian and Uzbek speakers before being shown as trusted dictionary meanings. A small number of contradictory source glosses are replaced only by explicit `AI correction draft` entries with review notes; the snapshots remain unchanged for audit.

## Rights and release decision

The exact upstream files used here are published with explicit license grants: HearMandarin and Zitou declare CC BY 4.0, while HanziBook declares CC BY-SA 4.0. The combined adapted vocabulary file is therefore marked CC BY-SA 4.0 and carries those attributions in the app. These grants cover reuse of the publishers' files under their terms. They are not an endorsement by CTI and do not resolve every question about the official syllabus itself.

### Official-resource check (2026-11-09)

- CTI's [Download Center](https://admin.chinesetest.cn/godownload.do) lists the 2015 HSK vocabulary list. The official [HSK 3.0 syllabus page](https://www.chinesetest.cn/syllabus) describes vocabulary as part of the syllabus, and CTI's [standards query system](https://admin.chinesetest.cn/standardsAction.do?means=standardInfo) provides a vocabulary search.
- CTI's [account/service terms](https://admin.chinesetest.cn/userregister/protocol_en.jsp) state that website content and related software are for services expressly stated on the site, and prohibit other uses including modification, publication, forwarding, reprinting, and derivative products. Its [legal notice](https://admin.chinesetest.cn/golawintro.do) says website content belongs to CTI or content providers and imposes conditions on reproduction and quotation.
- I found no open license on those official pages granting third-party apps permission to reproduce or republish CTI-hosted vocabulary material, and the pages do not conclusively identify the rights holder for each underlying syllabus/list. The app uses the separately published CC BY / CC BY-SA datasets listed above, not a fresh scrape or direct copy from CTI's site. The remaining uncertainty about the underlying official list is a cautious rights inference, not a legal determination.
- The official HSK page currently announces a planned worldwide HSK 3.0 launch on 2026-12-13. The local vocabulary snapshot is specifically the 2025 syllabus dataset; confirm which syllabus version the app should target before releasing a catalog.

### Safe release gate

Keep every imported source at `rights_status = pending` and `is_publishable = false`; keep vocabulary and translation rows unverified. The local feature-branch review build displays the candidate data with an unverified-content notice and attribution. Do not deploy or publish the review JSON until the remaining upstream-rights question is resolved and the Russian/Uzbek translations receive human review. The inquiry draft is in `data/vocabulary-candidates/rights/CTI_RIGHTS_INQUIRY.md`. The combined adapted data bundle is marked CC BY-SA 4.0 because it includes HanziBook/CC-CEDICT-derived meanings.

## Rebuild the local candidate

Run `py scripts/assemble_vocabulary_candidates.py` from the repository root. It reads the three snapshots above and writes the candidate CSV, translation backlog and checksum manifest. It performs no database connection or write.
