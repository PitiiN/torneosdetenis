# Mobile Migration Task List

- [ ] Modify `next.config.js` to enable static export (`output: 'export'`).
- [ ] Refactor React Server Components to Client Components (`"use client"`) where dynamic data fetching occurs.
- [ ] Migrate Next.js API Routes (`src/app/api/*`) to Supabase Edge Functions.
- [ ] Replace internal `fetch('/api/...')` calls with `supabase.functions.invoke()`.
- [ ] Implement client-side route protection (replacing Next.js Middleware).
- [ ] Verify Supabase Row Level Security (RLS) policies for secure direct-to-database client queries.
- [ ] Build and test the Capacitor Android and iOS apps without the VPS backend.
