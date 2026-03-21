# Production Bug Fixes - Dokploy Deployment

## Bug Fixes
- [x] Fix Dockerfile: Set `TZ=America/Santiago` in runner stage
- [x] Fix booking API: Timezone-aware end_at calculation
- [x] Fix availability week API: Ensure timezone-consistent loop
- [x] Run local build to verify no type errors
- [x] Commit and push all fixes

## User Actions Required
- [x] Add production domain to Supabase Auth redirect URLs
- [x] Verify Dokploy environment variables are complete
- [x] Redeploy on Dokploy
- [x] Test all 4 bugs are resolved
