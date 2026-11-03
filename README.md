# HanziPath — 汉字之路

A responsive React + Vite starter for a Chinese-learning platform supporting HSK 2.0 and HSK 3.0, with Russian, English, and Uzbek Latin interface languages.

## Included
- Russian / English / Uzbek Latin interface language selector
- Centralized translation keys for interface copy
- Guest language preference saved locally; signed-in preference is prepared through the Supabase `user_preferences` table
- HSK 2.0 and HSK 3.0 selector, vocabulary search, and level filters
- Demo vocabulary with pinyin, Russian/English meanings, examples, and browser speech synthesis
- Uzbek vocabulary and example translation fields with per-translation source and verification metadata
- Daily checklist and starter dashboard
- Supabase schema for vocabulary, grammar, exercises, spaced-repetition progress, and daily activity
- Demo mode without Supabase credentials

**Vocabulary note:** The visible vocabulary is sample data, not a complete or verified HSK dictionary. Uzbek word meanings are intentionally not generated or marked verified. No unverified external HSK dataset is included.

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
4. Restart the dev server.

The migration is additive. It does not import vocabulary, alter HSK 2.0 records, or delete or rewrite user progress. Never put a Supabase service-role key in frontend code; use only the anon/publishable key.

Profile language persistence requires a signed-in Supabase user. The current starter does not provide sign-in/sign-up flows; guests can always persist their choice in browser local storage.

## Publish
Import the existing repository into your hosting provider and configure the same two `VITE_SUPABASE_*` variables in its environment settings.
