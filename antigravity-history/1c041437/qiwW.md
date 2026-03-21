# Availability Grid and Court Schedules

This document combines the business rules for court operations with the technical implementation logic for the weekly availability grid.

## Court Schedules and Pricing

| Cancha | Weekday (Lun-Vie) | Weekend (Sáb-Dom) | Price/Hour | Slot Start Minute |
|--------|-------------------|-------------------|------------|-------------------|
| **Huelen 7** | 18:30 - 23:30 | 09:30 - 23:30 | $35.000 | :30 |
| **Huelen 5** | 18:30 - 23:30 | 09:30 - 23:30 | $15.000 | :30 |
| **Tabancura 6** | 19:00 - 22:00 | **Closed** | $30.000 | :00 |

### Pricing Logic
- Rates are per hour.
- Displayed price in the UI should match the `price_per_hour` for the 60-minute block.

## Visualization Rules (Grid Logic)

- **Default View**: Show current week (Monday to Sunday) upon login.
- **Court Selection**: 
    - Always display all active courts in the selection dropdown/list.
    - **Custom Sorting**: Courts are sorted by a specific order: 1. Huelen 7, 2. Huelen 5, 3. Tabancura 6.
    - **Primary Court**: "Huelen 7" is the default selection.
- **Navigation**:
    - **Forward**: Allow navigation to future weeks.
    - **Backward**: Restrict or disable navigation to past weeks to prevent invalid booking attempts.
- **Time Slots**:
    - Generates and displays only valid 60-minute block start times (e.g., :30 for Huelen, :00 for Tabancura).
    - Prevents alignment errors where users might book across a logical boundary.
- **Operating Hours**: Only show slots within the operating window for the selected court and day.

## Status Indicators (Legend)

| Status | Code/Label | Visual State | Description |
|--------|------------|--------------|-------------|
| **Available** | "Reservar" | 🟢 Green / Success | Slot is open for booking. |
| **Booked** | "Arrendada" | 🟠 Orange / Warning | Slot is occupied (Booking or Block). |
| **Closed** | "Cerrado" | ⬜ Muted / Gray | Outside of court operating hours. |
| **Past** | "-" | ⬜ Muted / Gray | Slot time has already passed. |

## UI Implementation
- Highlight the current day using semi-transparent primary colors.
- Use smooth transitions and hover scales (105%) for interactive slots.
- Display court-specific operating hours and pricing prominently in the header.
