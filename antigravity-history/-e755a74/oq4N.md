# Fix Production Bugs After Dokploy Deployment

The app works locally but has 4 bugs in production. The root cause is that the Docker container runs in UTC, while the app assumes `America/Santiago` timezone. This creates mismatches in booking time calculations and availability grid lookups.

## User Review Required

> [!IMPORTANT]
> **Supabase Redirect URL**: You need to add `https://arriendocanchas.clubf2.com` to your Supabase project's Auth **Redirect URLs** (Supabase Dashboard → Authentication → URL Configuration). Without this, login on the production domain will fail with "Failed to fetch".

> [!IMPORTANT]
> **Verify Dokploy Environment Variables**: Confirm that all 6 env vars are set in Dokploy, especially `SUPABASE_SERVICE_ROLE_KEY` (this one is NOT in `.env.production`, it must be set in Dokploy's Environment tab).

## Bug Analysis

| # | Bug | Root Cause |
|---|-----|-----------|
| 1 | Confirmar no avanza | API call likely succeeds (booking saved) but the response may fail due to auth/CORS. Also, after success the grid refresh may fail. |
| 2 | No se refleja en grilla | The week availability API uses `formatInTimeZone` on UTC server, producing wrong date keys (e.g., a booking at 23:00 Chile = 02:00 UTC next day). |
| 3 | 18:30 → 22:30 (multi-hour) | Server in UTC calculates `endAt` incorrectly: `addMinutes` on a UTC-parsed date produces wrong offset when combined with the Chile timezone suffix. |
| 4 | Admin "Failed to fetch" | Production domain not in Supabase's allowed redirect URLs list. |

## Proposed Changes

### Timezone Fix (Bugs 2 & 3)

#### [MODIFY] [route.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/api/bookings/route.ts)

Fix `end_at` calculation to use timezone-aware date math instead of naive `addMinutes` + string concatenation:

- Use `date-fns-tz` `fromZonedTime`/`toZonedTime` to correctly compute the end time in Chile timezone
- Remove the fragile `tzMatch` regex approach
- Ensure `start_at` and `end_at` are always stored as proper ISO strings with correct UTC offset

### Availability Grid Fix (Bug 2)

The week availability API already uses `formatInTimeZone` correctly. The issue is that `new Date(booking.start_at)` in the loop (line 110) may parse differently in UTC Docker. The fix will ensure the loop operates in Chile timezone consistently.

#### [MODIFY] [week/route.ts](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/src/app/api/availability/week/route.ts)

- Ensure the booking loop start/end times are parsed with timezone awareness
- Use `toZonedTime` before incrementing the loop

### Dockerfile Timezone (Systemic Fix)

#### [MODIFY] [Dockerfile](file:///c:/Users/Asus/OneDrive%20-%20CORPORACIÓN%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/ArriendoCanchas/Dockerfile)

Set `TZ=America/Santiago` in the Docker runner stage so that `new Date()` behaves consistently.

### Auth Fix (Bug 4)

This requires the user to add the production domain to Supabase's Auth redirect URLs — no code change needed.

## Verification Plan

### Automated Tests
- Run `npm run build` locally to confirm no type errors
- Deploy to Dokploy and test:
  1. Login with admin credentials
  2. Create a booking at 18:30 → verify it shows 18:30-19:30
  3. Verify it appears in the grid immediately
  4. Verify booking confirmation modal advances properly
