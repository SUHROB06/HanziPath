# HanziPath curriculum restructuring audit

Status: planning document only. No lesson assignments, database records, translations, production branch, or deployment are changed by this document.

Reviewed against `feature/vocabulary-database` and the separate `HanziPath-Test` staging catalog on 2026-11-16.

## 1. Current curriculum and catalog counts

The staging catalog currently contains these candidate membership counts:

| Standard | Level category | Candidate words |
|---|---:|---:|
| HSK 2.0 | 1 | 150 |
| HSK 2.0 | 2 | 150 |
| HSK 2.0 | 3 | 300 |
| HSK 2.0 | 4 | 600 |
| HSK 2.0 | 5 | 1,300 |
| HSK 2.0 | 6 | 2,500 |
| HSK 3.0 | 1 | 300 |
| HSK 3.0 | 2 | 200 |
| HSK 3.0 | 3 | 500 |
| HSK 3.0 | 4 | 1,000 |
| HSK 3.0 | 5 | 1,600 |
| HSK 3.0 | 6 | 1,800 |
| HSK 3.0 | 7-9 | 5,600 |

Current template counts in the feature branch:

- HSK 2.0: levels 1–6 have 15, 15, 20, 30, 24, and 28 lessons respectively (132 total).
- HSK 3.0: 10 themes per in-house stage, with 3 grammar modules per theme (30 lessons per stage; 270 total).
- The current assignment routine divides each level's vocabulary pool across all lesson templates. This means the result cannot consistently meet the requested 15–25 new words per lesson: some levels are below 15, while others are far above 25.

## 2. Proposed vocabulary-unit counts

For planning, use approximately 20 new words per vocabulary lesson. The following counts keep each unit between 15 and 25 words without duplicating headwords.

| Standard | Level | Candidate words | Proposed vocabulary lessons | Distribution |
|---|---:|---:|---:|---|
| HSK 2.0 | 1 | 150 | 8 | six units of 19, two of 18 |
| HSK 2.0 | 2 | 150 | 8 | six units of 19, two of 18 |
| HSK 2.0 | 3 | 300 | 15 | 20 each |
| HSK 2.0 | 4 | 600 | 30 | 20 each |
| HSK 2.0 | 5 | 1,300 | 65 | 20 each |
| HSK 2.0 | 6 | 2,500 | 125 | 20 each |
| HSK 3.0 | 1 | 300 | 15 | 20 each |
| HSK 3.0 | 2 | 200 | 10 | 20 each |
| HSK 3.0 | 3 | 500 | 25 | 20 each |
| HSK 3.0 | 4 | 1,000 | 50 | 20 each |
| HSK 3.0 | 5 | 1,600 | 80 | 20 each |
| HSK 3.0 | 6 | 1,800 | 90 | 20 each |
| HSK 3.0 | 7-9 | 5,600 | 280 | 20 each across in-house stages |

Total planned vocabulary units: 251 for HSK 2.0 and 550 for HSK 3.0.

The HSK 3.0 official category 7-9 must remain a single combined standard category in data and UI. If the course needs three teaching stages, they are internal pedagogical stages only, not official HSK levels. A future distribution should be topic- and difficulty-based, not alphabetical modulo slicing.

## 3. Curriculum model to implement

Separate vocabulary lessons from grammar lessons.

Each vocabulary unit should have:
- 15–25 genuinely new headwords/readings;
- a topic title and learning objectives;
- simplified characters, traditional form where available, tone-marked pinyin;
- Russian, English, and Uzbek meanings with source and verification metadata;
- example sentences and translations only when editorially reviewed;
- a lesson-level unique-word check and a course-level no-duplicate-new-word check.

Grammar modules should be attached to a suitable vocabulary unit or remain separately browsable. A grammar module must not create an extra vocabulary lesson with a tiny remainder.

Topic assignment should use curated Chinese-headword topic tags or explicit reviewed mappings. Do not score substring matches in translated meanings: this can assign unrelated words to a topic. Words without a defensible topic should go into a clearly named review queue, not be silently appended to an unrelated lesson.

## 4. Required validation before publishing

1. Confirm every vocabulary unit has 15–25 new words.
2. Confirm every standard membership is represented exactly once in its course sequence unless a documented pedagogical exception is approved.
3. Check duplicates by simplified headword + reading; preserve distinct readings/senses and resolve conflicting source rows rather than silently dropping them.
4. Verify pinyin and RU/EN/UZ meanings with fluent reviewers. Existing AI drafts remain unverified.
5. Keep the candidate catalog private and non-publishable until underlying HSK-list rights and upstream license questions are resolved.
6. Do not promote the review dataset, merge to `main`, or deploy it as a public dictionary as part of this restructuring.

## 5. Implementation sequence

1. Build a deterministic audit report for counts, duplicates, missing fields, and current lesson coverage.
2. Define reviewed topic tags and a reviewed word-to-topic mapping.
3. Create vocabulary-unit records separately from grammar lesson templates.
4. Generate balanced 15–25-word units within each level while preserving the official 7-9 combined category.
5. Attach original grammar, dialogue, reading, listening, and exercises to the units.
6. Run validation and review the units level by level, beginning with HSK 2.0 level 1.
