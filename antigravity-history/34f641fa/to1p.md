# Availability Grid Visualization Rules

The ArriendoCanchas application uses a weekly grid view to manage bookings.

## Grid Logic
- **Default View**: Show current week (Monday to Sunday) upon login.
- **Court Selection**: 
    - Always display all active courts in the selection dropdown/list.
    - **Primary Court**: "Huelen 7" must always be the first court in the list and the default selection upon page load.
- **Navigation**:
    - **Forward**: Allow users to navigate to future weeks to view availability and create bookings.
    - **Backward**: **Restrict** or disable backward navigation to past weeks to prevent invalid booking attempts and maintain historical data integrity.
- **Time Slots**: UI generates and displays only the specific start times allowed for each court (e.g., :30 marks for Huelen, :00 marks for Tabancura) to prevent alignment errors. Blocks are 60 minutes.
- **Slot Alignment**:
    - **Huelen 7 & 5**: Slots start at :30 (18:30, 19:30, etc. on weekdays; starting 09:30 on weekends).
    - **Tabancura 6**: Slots start at :00 (19:00, 20:00, etc.).
- **Operating Hours**: Display slots within the valid operating window for the selected court.

## Status Indicators (Legend)
- **Reservar** (Available): Success color/badge.
- **Arrendada** (Booked): Success color/badge or warning.
- **Cerrado** (Closed): Muted/Disabled for slots outside operating hours.
- **Past**: Slots in the past within the current week should be disabled even if they were "available".

## Pricing Display
- Show the price per hour for the selected court prominently above the grid.
- Summarize final total in the confirmation modal.
