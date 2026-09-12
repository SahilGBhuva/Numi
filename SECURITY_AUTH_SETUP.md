# Bindit authentication setup

The `secure-auth` branch requires Supabase Auth.

Set these backend environment variables locally and in deployment:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `DATABASE_URL` for persistent production progress

Do not put a Supabase service-role key in frontend code or commit it to GitHub.

The frontend now requires login/signup before rendering the app. Authenticated API requests include the Supabase access token. The FastAPI backend verifies that token with Supabase and uses the verified account ID for progress updates instead of trusting a browser-generated student ID.
