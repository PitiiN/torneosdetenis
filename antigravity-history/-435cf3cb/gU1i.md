# Next.js Build-Time Environment Variables

Next.js inlines `NEXT_PUBLIC_` variables into the JavaScript bundle during the build phase. If these variables are not available during `npm run build`, they will be `undefined` at runtime in the browser, potentially causing "Internal Server Error" (500) if the application relies on them for initialization (e.g., Supabase client).

## Symptom
- App builds successfully but throws 500 errors on the client.
- Logs show: `Error: Your project's URL and Key are required to create a Supabase client!`

## Deployment Configuration (Dokploy)
By default, Dokploy injected variables are often only available at **runtime**. To make them available at **build-time**, one would normally use Docker `ARG`, but this requires matching configuration in Dokploy.

## Recommended Fix: .env.production
Create a `.env.production` file containing the **public** keys. Next.js automatically loads this file during build.

1. Create `.env.production` with safe public keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_APP_URL=...
   ```
2. **Crucial**: Ensure `.env.production` is NOT in `.gitignore` or `.dockerignore` for the production build.
3. Remove redundant `ARG` and `ENV` instructions from the `Dockerfile` if they are overriding the file with empty values.

## Security Note
Never put sensitive keys (like `SUPABASE_SERVICE_ROLE_KEY`) in `.env.production`. Keep those in the hosting platform's environment settings (Runtime only).
