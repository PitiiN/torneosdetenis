# Availability Grid Visualization Rules

The ArriendoCanchas application uses a weekly grid view to manage bookings.

## Grid Logic
- **Default View**: Show current week (Monday to Sunday) upon login.
- **Navigation**:
    - **Forward**: Allow users to navigate to future weeks to view availability and create bookings.
    - **Backward**: **Restrict** or disable backward navigation to past weeks to prevent invalid booking attempts and maintain historical data integrity.
- **Time Slots**: UI displays slots in 30-minute increments (e.g., 18:00, 18:30) to provide granular view, although default selections create 1-hour bookings.
- **Slot Alignment**:
    - **Huelen 7 & 5**: Slots must align with the opening time (09:30 on weekends, 18:30 on weekdays). Bookings are 1-hour blocks (e.g., 18:30-19:30, 19:30-20:30). Users **cannot** book at :00 (e.g., 19:00) if it breaks the alignment.
    - **Tabancura 6**: Slots must align with the opening time (19:00). Users **cannot** book at :30 (e.g., 19:30).
- **Operating Hours**: Display slots starting from 09:00 to 23:00.

## Status Indicators (Legend)
- **Reservar** (Available): Success color/badge.
- **Arrendada** (Booked): Success color/badge or warning.
- **Cerrado** (Closed): Muted/Disabled for slots outside operating hours.
- **Past**: Slots in the past within the current week should be disabled even if they were "available".

## Pricing Display
- Show the price per hour for the selected court prominently above the grid.
- Summarize final total in the confirmation modal.
