# Availability Grid Visualization Rules

The ArriendoCanchas application uses a weekly grid view to manage bookings.

## Grid Logic
- **Default View**: Show current week (Monday to Sunday) upon login.
- **Navigation**:
    - **Forward**: Allow users to navigate to future weeks to view availability and create bookings.
    - **Backward**: **Restrict** or disable backward navigation to past weeks to prevent invalid booking attempts and maintain historical data integrity.
- **Time Slots**: Display hourly slots based on court-specific calendars (see `court_schedules.md`).

## Status Indicators (Legend)
- **Reservar** (Available): Success color/badge.
- **Arrendada** (Booked): Success color/badge or warning.
- **Cerrado** (Closed): Muted/Disabled for slots outside operating hours.
- **Past**: Slots in the past within the current week should be disabled even if they were "available".

## Pricing Display
- Show the price per hour for the selected court prominently above the grid.
- Summarize final total in the confirmation modal.
