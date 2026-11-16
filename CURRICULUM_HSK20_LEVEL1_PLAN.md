# HanziPath — HSK 2.0 Level 1 curriculum plan

## Scope

This change restructures only the HanziPath HSK 2.0 Level 1 sequence. It does not alter official HSK membership, the vocabulary catalog, HSK 3.0, exams, or production deployment.

The staging catalog currently contains 150 HSK 2.0 Level 1 vocabulary memberships. HanziPath keeps 15 lessons to align with the pedagogical progression of *HSK Standard Course 1*. The book's table of contents has 15 lessons and covers 150 words; HanziPath uses its broad progression as a reference, not its textbook prose, dialogues, exercises, or copied content.

## Original HanziPath lesson sequence

1. Приветствие и первое общение — greetings and first exchanges
2. Благодарность и простые ответы — thanks, apologies, and short responses
3. Имя и знакомство — asking and giving names
4. Люди и отношения — people, roles, and relationships
5. Семья, числа и возраст — family, numbers, and age
6. Язык и умения — language learning and abilities
7. Дата и календарь — dates and calendar
8. Напитки и простая просьба — drinks, food, and polite requests
9. Работа и место — work and asking where someone works
10. Место и разрешение — locations and asking permission
11. Время и распорядок дня — clock time and daily schedule
12. Погода на завтра — weather and simple descriptions
13. Китайская еда и действия сейчас — Chinese food and actions in progress
14. Покупки и одежда — shopping and clothing
15. Поездка и транспорт — travel and transport

## Allocation rule

- Keep official HSK 2.0 Level 1 membership separate from HanziPath's teaching sequence.
- Allocate the 150 catalog entries across 15 lessons (nominally 10 new entries per lesson in this first level).
- Use lesson themes and Chinese vocabulary keywords to prioritize topical matches.
- Each catalog entry must be assigned once; review the resulting per-lesson word lists in the UI before marking the lessons publishable.
- The database lessons remain `is_publishable = false` pending review.
- Do not add words to the official HSK membership to make lesson sizes look more even. Any supplementary teaching vocabulary must be labelled separately.

## Source and originality

Reference for the sequence: HSK Standard Course 1 table of contents and public course description:
- https://www.hskstandardcourse.com/hsk-standard-course-level-1/hsk-standard-course-1-textbook/
- https://zhongwenshu.de/goods.php?id=3109

The HanziPath lesson titles, explanations, examples, and learning activities are original. This is a curriculum-structure reference only, not a reproduction of the book.

## Validation still required

- Open the course in the web app and inspect all 15 lesson word lists.
- Confirm exactly 150 distinct HSK 2.0 Level 1 entries are represented once, with no omissions or duplicates.
- Check that each lesson's assigned words fit its topic; adjust any fallback assignments manually.
- Review grammar explanations and translations before changing `is_publishable` to true.
- Run the project's typecheck and production build before deployment.
