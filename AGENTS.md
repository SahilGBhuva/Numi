# CAC study app

Vite + React + TypeScript. Run with `npm install` then `npm run dev` (http://localhost:5173).

## Product (v1)

High school students paste notes or a topic, take a short multiple-choice quiz, and see score plus streak/XP. Questions are hardcoded or derived from pasted text. No AI until that loop works.

## Conventions

- Keep session types (`Question`, `Attempt`, `Session`) in one types file.
- Persist the last session in `localStorage`.
- Put any future AI calls behind `lib/ai.ts` with a sample-question fallback when a key is missing.

## Secrets

Never commit API keys, `.env` files, or credentials. Use `.env.local` (gitignored) for local secrets.
