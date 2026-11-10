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
- The candidate review JSON and generated import batches are kept out of Git by ignore rules. Work remains on the pushed `feature/vocabulary-database` branch. No `main` change, merge, or production deployment was made; the branch has Vercel preview deployments for review.

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

The dataset publishers declare licenses for their own files: HearMandarin and Zitou declare CC BY 4.0, while HanziBook declares CC BY-SA 4.0. Those declarations do not, by themselves, establish permission from the relevant rights holder to reproduce the underlying official HSK lists or their level memberships.

The combined candidate bundle is provisionally treated as CC BY-SA 4.0 because it includes HanziBook/CC-CEDICT-derived content. This is a conservative working label, not a confirmed blanket license from every upstream contributor. HearMandarin's source page says its English teaching glosses start from CC-CEDICT (CC BY-SA 4.0) and are rewritten into short glosses, while its dataset is offered under CC BY 4.0. That interaction needs written clarification from the publisher before we rely on the English-meaning field or redistribute the combined data.

No open reuse grant for the official HSK 2.0/3.0 lists was located on CTI's official pages. CTI's site terms describe website content as protected and limit uses beyond the named services; the current HSK syllabus cover names the Center for Language Education and Cooperation as issuer. The terms do not conclusively identify who controls each list or grant a reuse license for the list data. This is a conservative rights assessment, not a legal determination. Keep list rights pending until written permission or a suitable legal review resolves it.

## Original lesson vocabulary

`src/data/lessonVocabulary.ts` contains 464 HanziPath-authored entries for the lesson activities. This set was written for the course and is not imported from the candidate datasets or presented as an official HSK vocabulary list. Stages 1–6 are used in the HSK 2.0 and HSK 3.0 course flows; stages 7–9 are used only in the HSK 3.0 course flow. Stage labels are a teaching sequence and do not claim independently verified HSK membership. RU/EN/UZ glosses are editorial drafts and must be reviewed by fluent speakers before being treated as trusted translations.

### Official-resource check (2026-11-09)

- CTI's [Download Center](https://admin.chinesetest.cn/godownload.do) lists the 2015 HSK vocabulary list. The official [HSK 3.0 syllabus page](https://www.chinesetest.cn/syllabus) describes vocabulary as part of the syllabus, and CTI's [standards query system](https://admin.chinesetest.cn/standardsAction.do?means=standardInfo) provides a vocabulary search.
- CTI's [account/service terms](https://admin.chinesetest.cn/userregister/protocol_en.jsp) state that website content and related software are for services expressly stated on the site, and prohibit other uses including modification, publication, forwarding, reprinting, and derivative products. Its [legal notice](https://admin.chinesetest.cn/golawintro.do) says website content belongs to CTI or content providers and imposes conditions on reproduction and quotation.
- The currently linked [official HSK syllabus PDF](https://hsk.cn-bj.ufileos.com/3.0/%E6%96%B0%E7%89%88HSK%E8%80%83%E8%AF%95%E5%A4%A7%E7%BA%B21219.pdf) is labeled as published in November 2025 and implemented in July 2026. It lists levels 1–6 and a combined 7–9 band. The local candidate snapshot is explicitly the 2025 syllabus dataset; do not relabel it as the 2021 syllabus or split its 7–9 band into three official levels.
- I found no open license on those official pages granting third-party apps permission to reproduce or republish the HSK vocabulary lists. The syllabus PDF identifies the Center for Language Education and Cooperation as issuer, while the website is operated by CTI; the rights holder for each list still needs confirmation. The app uses separately published third-party datasets, not a fresh scrape of the CTI search system. This does not remove the underlying list-rights question.
- HearMandarin's current [data-source explanation](https://hearmandarin.com/data-sources/) confirms its CC BY 4.0 declaration, and also says its English glosses are adapted from CC-CEDICT under CC BY-SA 4.0. Ask the publisher to clarify the license relationship before relying on those glosses as CC BY 4.0 alone.
- Zitou's current [dataset card](https://huggingface.co/datasets/Maqsudjonpolatov/hsk-chinese-uzbek-russian) declares CC BY 4.0 for the Uzbek/Russian meanings and says they were prepared with AI assistance and corrected over time. This is provenance, not a human-review guarantee for our copied entries.
- HanziBook's [license and attribution page](https://hanzibook.com/en/guide/hsk-3-0-anki-deck) declares CC BY-SA 4.0 and identifies the word-list/pinyin source as the MIT-licensed `complete-hsk-vocabulary` project, its English meanings as CC-CEDICT-derived, and its Russian meanings as adapted from those entries. Preserve the share-alike obligations and attribution if this source is used.
- The official HSK announcement currently gives December 13, 2026 as the first worldwide HSK 3.0 session. This is a rollout date, not a vocabulary-list license.

### Candidate data quality check (2026-11-09)

The ignored local candidate bundle was read without changing or importing it:

- 11,147 source rows: 5,000 HSK 2.0 memberships and 11,000 HSK 3.0 (2025 syllabus) memberships, with overlap.
- 11,105 distinct simplified-headword/Pinyin pairs; 42 rows repeat that pair. In 41 groups the repeated rows carry different glosses and/or level assignments. One group (`粉丝`, `fěnsī`) is identical across the checked content fields and differs only by source key/sequence. Preserve the raw source rows and resolve this during import normalization rather than silently dropping records.
- All 11,147 rows have tone-marked and numeric Pinyin fields. This checks presence and formatting only; Pinyin accuracy remains unverified.
- 3,590 Russian and 3,850 Uzbek meanings are AI drafts; 218 Russian and 231 Uzbek fields have source headword matches that need reading review. The review queue contains 3,850 draft rows. The empty translation backlog means no cells are blank, not that translations are approved.
- Every candidate membership is `unverified`; every source has `rights_status = pending`; every English meaning is `source_unverified`. No candidate translation is marked verified.
- Candidate CSVs, source snapshots, and the review JSON remain local and ignored; they are not present in the feature branch or public deployment.

The current catalog schema uses source-entry keys to preserve separate source rows, but it has no first-class sense table. `standard_memberships` permits one level per item per standard version, while translations are unique per item/reading/locale/source. Before writing an importer, define how repeated headwords with different meanings or levels will map to item/sense records and how the public dictionary will group them. Do not let those rows become accidental duplicate flashcards.

### Safe release gate

Keep every imported source at `rights_status = pending` and `is_publishable = false`; keep vocabulary and translation rows unverified. Do not deploy or publish the review JSON until the underlying HSK-list rights and the HearMandarin license interaction are clarified, the data is normalized against the catalog schema, and Russian/Uzbek translations receive human review. The inquiry draft is in `data/vocabulary-candidates/rights/CTI_RIGHTS_INQUIRY.md`; it has not been sent. No SQL writes or Supabase imports were performed during this audit.

## Rebuild the local candidate

Run `py scripts/assemble_vocabulary_candidates.py` from the repository root. It reads the three snapshots above and writes the candidate CSV, translation backlog and checksum manifest. It performs no database connection or write.
