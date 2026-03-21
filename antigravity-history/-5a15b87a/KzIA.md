# Production Timezone Fix — Walkthrough

## Problem
App worked locally but had 4 bugs in Dokploy (Docker):
1. Booking confirmation didn't advance
2. Bookings not reflected in the grid
3. Multi-hour time mismatch (18:30 → 22:30)
4. Admin "Failed to fetch" (Supabase was paused)

**Root cause**: Docker runs in UTC. Date math like `addMinutes` + string formatting produced wrong Chile-timezone offsets.

## Changes Made

### 1. [Dockerfile](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/Dockerfile)
- Added `TZ=America/Santiago` env var to builder and runner stages
- Installed `tzdata` package in Alpine Linux runner

### 2. [bookings/route.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/api/bookings/route.ts)
- Replaced fragile regex-based timezone offset (`tzMatch`) with `formatInTimeZone`
- Both `start_at` and `end_at` now formatted with proper Chile offset

### 3. [availability/week/route.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/api/availability/week/route.ts)
- Changed booking loop to use `parseISO` + millisecond arithmetic
- `formatInTimeZone` used for extracting date/time strings

## Verification
- ✅ Local build passes (exit code 0, no type errors)
- ✅ Pushed to `origin/main`
- ⏳ Waiting for user to redeploy on Dokploy and test
