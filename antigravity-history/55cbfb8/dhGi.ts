export const COURT_SCHEDULES: Record<string, {
    weekday: { start: string; end: string };
    weekend: { start: string; end: string } | null;
    pricePerHour: number;
    slotStartMinute: number;
}> = {
    'Huelén 7': {
        weekday: { start: '18:30', end: '23:30' },
        weekend: { start: '09:30', end: '23:30' },
        pricePerHour: 35000,
        slotStartMinute: 30,
    },
    'Huelén 5': {
        weekday: { start: '18:30', end: '23:30' },
        weekend: { start: '09:30', end: '23:30' },
        pricePerHour: 15000,
        slotStartMinute: 30,
    },
    'Tabancura 6': {
        weekday: { start: '19:00', end: '22:00' },
        weekend: null,
        pricePerHour: 30000,
        slotStartMinute: 0,
    },
}
