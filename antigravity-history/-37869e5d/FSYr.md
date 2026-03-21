# Production Bug Fixes - Dokploy Deployment

## Bug Fixes
- [ ] Fix Dockerfile: Set `TZ=America/Santiago` in runner stage
- [ ] Fix booking API: Timezone-aware end_at calculation
- [ ] Fix availability week API: Ensure timezone-consistent loop
- [ ] Run local build to verify no type errors
- [ ] Commit and push all fixes

## User Actions Required
- [ ] Add production domain to Supabase Auth redirect URLs
- [ ] Verify Dokploy environment variables are complete
- [ ] Redeploy on Dokploy
- [ ] Test all 4 bugs are resolved
