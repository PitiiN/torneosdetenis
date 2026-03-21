# Mobile Migration Task List (React Native / Expo)

- [x] Initialize a new Expo project alongside the existing Next.js project.
- [x] Configure Supabase client for React Native (using `react-native-url-polyfill`).
- [x] Implement Expo Router for navigation (Stack and Tabs).
- [x] Rebuild the Authentication flow (Login/Register) using Native UI components.
- [x] Rebuild the core Player flows (Dashboard, Court Search, Booking, Profile).
- [x] Rebuild the Admin/Owner flows (Dashboard, Agenda, Financials).
    - [x] Admin Dashboard with key metrics.
    - [x] Interactive Agenda with booking management.
    - [x] Financials screen with revenue breakdown.
    - [/] Slot blocking and recurring blocks management.
- [ ] Migrate server-side Next.js API Routes (`src/app/api/*`) to Supabase Edge Functions.
    - [ ] Booking confirmation emails (Resend).
    - [ ] Admin management functions (Service Role bypass).
- [ ] Set up Expo Application Services (EAS) for building the Android APK and iOS IPA.
