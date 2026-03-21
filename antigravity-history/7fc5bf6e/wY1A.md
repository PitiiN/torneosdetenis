# Weekly Availability Data Aggregation

To provide a comprehensive view of court status, the API must aggregate both user bookings and administrative blocks (maintenance, reserved times) over a specific date range.

## Implementation Pattern (`/api/availability/week/route.ts`)

1. **Parameters**: Expect `fieldId`, `startDate`, and `endDate`.
2. **Querying**: 
    - Fetch from `bookings` where status is valid (e.g., `PENDIENTE_PAGO`, `EN_VERIFICACION`, `PAGADA`).
    - Fetch from `blocks` (administrative reservations).
3. **Data Transformation & Normalization**:
    - Iterate through all days in the interval using `eachDayOfInterval`.
    - Group results by date string (`yyyy-MM-dd`).
    - Normalize both **bookings** (customer orders) and **blocks** (admin shutdowns) into a common "booked slot" format. This ensures the frontend doesn't need to differentiate between why a slot is unavailable.

## Example Data Structure

```json
{
  "slots": {
    "2026-02-09": [
      { "startTime": "18:30", "endTime": "19:30", "status": "booked" }
    ],
    "2026-02-10": []
  }
}
```

## Considerations
- **Timezone Safety**: Ensure comparison uses ISO strings or unified timezone handling on the server.
- **Type Safety**: Use explicit interfaces for Supabase results to avoid `never` type inference (see `supabase_typescript_integration`).
