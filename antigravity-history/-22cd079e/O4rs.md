# Responsive Scheduling Grid Pattern

Traditional HTML tables are often rigid for complex scheduling dashboards. Using CSS Grid with Tailwind CSS allows for better responsiveness, card-like styling, and interaction animations.

## Implementation Structure

The grid is defined with a dynamic number of columns and a fixed "Time" label column.

```tsx
<div className="grid gap-2" style={{ gridTemplateColumns: 'auto repeat(7, 1fr)' }}>
    {/* Time Column Header */}
    <div className="p-3 text-center text-sm font-semibold text-muted-foreground">Hora</div>
    
    {/* Day Column Headers */}
    {weekDays.map((day) => (
        <div className={cn("p-3 text-center rounded-lg", isToday(day) ? "bg-primary/20" : "bg-secondary/50")}>
            {/* Day name and date */}
        </div>
    ))}

    {/* Time Rows */}
    {timeSlots.map((time) => (
        <>
            <div className="p-3 text-sm font-bold bg-secondary/30 rounded-lg">{time}</div>
            {weekDays.map((day) => (
                <button className={cn("p-3 rounded-lg text-xs font-semibold")}>
                    {/* Interaction Button */}
                </button>
            ))}
        </>
    ))}
</div>
```

## Styling Principles
1. **Rounded Cells**: Use `rounded-lg` on buttons and labels to move away from the "spreadsheet" look.
2. **Visual Feedback**: Apply `hover:scale-105` and `transition-all` to slots to make the interface feel interactive.
3. **Status Colors**:
   - **Success (Green)**: Available for booking.
   - **Warning (Orange)**: Booked.
   - **Muted**: Closed or Past.
4. **Conditional Formatting**: Highlight the current day using semi-transparent primary colors (`bg-primary/20`).

## Navigation & Filtering
- **Sync Navigation**: The grid should update based on a centralized `currentWeekStart` state.
- **Dynamic Slot Generation**: Time slots should be filtered at the component level to only show valid intervals (e.g., 60-min blocks aligned with court opening times).
