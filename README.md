# HanziPath — 汉字之路

A responsive React + Vite starter for a Chinese-learning platform supporting both HSK 2.0 and HSK 3.0.

## Included in this starter
- Russian / English interface switch
- HSK 2.0 and HSK 3.0 selector
- Vocabulary search and level filters
- Sample vocabulary entries with pinyin, RU/EN meanings and example sentences
- Mandarin pronunciation via browser speech synthesis (voice availability depends on device)
- Daily checklist and starter dashboard
- Supabase schema for vocabulary, grammar, exercises, spaced-repetition progress and daily activity
- Demo mode without Supabase credentials

**Important:** The visible vocabulary is only sample data. This starter does not claim to contain a complete, verified HSK dictionary or a complete native audio library. Populate the database only from a documented, licensed/allowed source and verify translations before marking records `verified=true`.

## Run locally
1. Install Node.js 20 or newer.
2. Extract the ZIP.
3. In this folder run:
   ```bash
   npm install
   npm run dev
   ```
4. Open the local URL printed by Vite.

## Connect Supabase
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/migrations/001_initial_schema.sql`.
3. Copy `.env.example` to `.env`.
4. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Restart the dev server.

Never put a Supabase service-role key in frontend code. Only use the anon/publishable key in this app; RLS policies protect private user progress.

## Publish free (subject to provider limits)
1. Create a GitHub repository and upload this project.
2. In Vercel choose **Add New → Project**, import the GitHub repository.
3. Vercel detects Vite automatically. Add the same two `VITE_SUPABASE_*` environment variables in Project Settings → Environment Variables.
4. Deploy. Your public `*.vercel.app` URL will appear after a successful deployment.

## Next development milestones
1. Add Supabase sign-up/sign-in UI and persistent progress writes.
2. Import verified vocabulary for both standards with source/version metadata.
3. Add actual listening recordings or a licensed TTS provider.
4. Build flashcard scheduling, grammar content, sentence-order exercises and timed mock exams.
5. Add admin-only import tooling and tests for vocabulary counts/duplicates.
