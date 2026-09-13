# bindet authentication setup

bindet uses Supabase Auth for account identity.

Set these backend environment variables locally and in deployment:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `DATABASE_URL` for persistent production progress and generated quiz questions

Do not put a Supabase service-role key in frontend code or commit it to GitHub. The anon key is intended to be public.

The frontend requires login/signup before rendering the app. Authenticated API requests include the Supabase access token. FastAPI verifies that token with Supabase and derives the user ID from the verified account rather than trusting browser-supplied identity.

Quiz answers are also kept server-side. `/api/generate-question` returns an opaque `question_id`, and `/api/analyze-answer` accepts only that ID plus the student's answer. Correct answers are stored in the database and a completed question cannot award XP twice.

Production requires `DATABASE_URL`. On Vercel, or with `APP_ENV=production`, the backend refuses to start if it is missing or is not a PostgreSQL URL, rather than silently storing data in temporary SQLite. SQLite is only used for local development and tests.
