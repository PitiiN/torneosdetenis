
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    // Use Admin Client to bypass RLS (needed for 'PAGADA' status and force inserts)
    const supabase = await createAdminClient()

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Debes iniciar sesión primero' }, { status: 401 })
    }

    // 2. Get Field IDs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fields } = await supabase
        .from('fields')
        .select('id, name')
        .in('name', ['Huelén 7', 'Huelén 5', 'Tabancura 6']) as { data: any[] | null }

    if (!fields || fields.length === 0) {
        return NextResponse.json({ error: 'No se encontraron las canchas' }, { status: 404 })
    }

    const huelen7 = fields.find((f: any) => f.name === 'Huelén 7')
    const huelen5 = fields.find((f: any) => f.name === 'Huelén 5')
    const tabancura6 = fields.find((f: any) => f.name === 'Tabancura 6')

    const newBookings = []

    // Helper to create timestamp YYYY-MM-DDTHH:mm:00-03:00
    const getTimestamp = (day: number, time: string) => `2026-02-${day.toString().padStart(2, '0')}T${time}:00-03:00`

    // 3. Generate Bookings

    // Case A: Huelén 7 - Tuesdays (Martes) - 21:30
    // Dates: Feb 3, 10, 17, 24
    if (huelen7) {
        const tuesdays = [3, 10, 17, 24]
        for (const day of tuesdays) {
            // Past dates (Feb 3) -> Paid (PAGADA), Future -> Pending (PENDIENTE_PAGO)
            // Current mock time is Feb 5th. So Feb 3 is past.
            const isPast = day < 5
            const status = isPast ? 'PAGADA' : 'PENDIENTE_PAGO'

            newBookings.push({
                field_id: huelen7.id,
                user_id: user.id,
                start_at: getTimestamp(day, '21:30'),
                end_at: getTimestamp(day, '23:00'),
                duration_minutes: 90,
                price_total_cents: 3500000,
                status: status,
                court_name: 'Huelén 7' // For log
            })
        }
    }

    // Case B: Huelén 5 - Wednesdays (Miércoles) - 18:30
    // Dates: Feb 4, 11, 18, 25
    // All Pending
    if (huelen5) {
        const wednesdays = [4, 11, 18, 25]
        for (const day of wednesdays) {
            newBookings.push({
                field_id: huelen5.id,
                user_id: user.id,
                start_at: getTimestamp(day, '18:30'),
                end_at: getTimestamp(day, '20:00'),
                duration_minutes: 90,
                price_total_cents: 3500000,
                status: 'PENDIENTE_PAGO',
                court_name: 'Huelén 5'
            })
        }
    }

    // Case C: Tabancura 6 - Fridays (Viernes) - 20:00
    // Dates: Feb 6, 13, 20, 27
    // All Pending
    if (tabancura6) {
        const fridays = [6, 13, 20, 27]
        for (const day of fridays) {
            newBookings.push({
                field_id: tabancura6.id,
                user_id: user.id,
                start_at: getTimestamp(day, '20:00'),
                end_at: getTimestamp(day, '21:30'),
                duration_minutes: 90,
                price_total_cents: 3500000,
                status: 'PENDIENTE_PAGO',
                court_name: 'Tabancura 6'
            })
        }
    }

    // 4. Insert into DB
    const results = []
    for (const booking of newBookings) {
        const { court_name, ...bookingData } = booking
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from('bookings').insert(bookingData as any)
        results.push({
            desc: `${court_name} at ${booking.start_at}`,
            status: error ? 'error' : 'success',
            error: error?.message
        })
    }

    return NextResponse.json({
        message: 'Proceso de creación de reservas finalizado',
        summary: results
    })
}
