import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

export const dynamic = 'force-dynamic'

const TIME_ZONE = 'America/Santiago'

interface BookingRecord {
    id: string
    start_at: string
    end_at: string
    status: string
    created_at: string
    created_source?: string
}

interface BlockRecord {
    id: string
    start_at: string
    end_at: string
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { searchParams } = new URL(request.url)
        const fieldId = searchParams.get('fieldId')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        if (!fieldId || !startDate || !endDate) {
            return NextResponse.json(
                { error: 'fieldId, startDate, and endDate are required' },
                { status: 400 }
            )
        }

        // Get all bookings for this field in the date range
        const { data: bookingsData, error } = await supabase
            .from('bookings')
            .select('id, start_at, end_at, status, created_at, created_source')
            .eq('field_id', fieldId)
            .gte('start_at', `${startDate}T00:00:00`)
            .lte('start_at', `${endDate}T23:59:59`)
            .not('status', 'in', '("CANCELADA","RECHAZADA","EXPIRADA")')

        const bookings = bookingsData as BookingRecord[] | null

        if (error) {
            console.error('Error fetching bookings:', error)
            return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
        }

        // Get all blocks for this field in the date range
        const { data: blocksData } = await supabase
            .from('blocks')
            .select('id, start_at, end_at')
            .eq('field_id', fieldId)
            .gte('start_at', `${startDate}T00:00:00`)
            .lte('start_at', `${endDate}T23:59:59`)

        const blocks = blocksData as BlockRecord[] | null

        // Organize bookings by date
        const slots: Record<string, { startTime: string; endTime: string; status: 'booked' | 'pending' | 'blocked' }[]> = {}

        // Initialize all dates
        const days = eachDayOfInterval({
            start: parseISO(startDate),
            end: parseISO(endDate),
        })

        days.forEach((day) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            slots[dateStr] = []
        })

        // Add bookings
        bookings?.forEach((booking) => {
            // Check expiration for pending bookings (10 mins)
            // ONLY if it's not created by admin
            if (booking.status === 'PENDIENTE_PAGO' && booking.created_source !== 'admin') {
                const createdTime = new Date(booking.created_at).getTime()
                const now = Date.now()
                // Allow 10 mins (600,000 ms)
                if (now - createdTime > 10 * 60 * 1000) {
                    return // Skip (expired), behaves as available
                }
            }

            // Convert UTC to 'America/Santiago' for display
            const dateStr = formatInTimeZone(booking.start_at, TIME_ZONE, 'yyyy-MM-dd')
            const startTime = formatInTimeZone(booking.start_at, TIME_ZONE, 'HH:mm')
            const endTime = formatInTimeZone(booking.end_at, TIME_ZONE, 'HH:mm')

            if (slots[dateStr]) {
                // User wants PENDIENTE_PAGO to appear as "Arrendada" (Booked) for public view
                // BLOQUEADA should appear as "Bloqueada" (Blocked - Purple) or handled by client
                // We pass the status through, normalizing BLOQUEADA to 'blocked' if needed, or keeping as is if client handles it.
                // Let's pass 'blocked' for BLOQUEADA
                let status: 'booked' | 'pending' | 'blocked' = 'booked'

                if (booking.status === 'BLOQUEADA') {
                    status = 'blocked'
                } else if (booking.status === 'PENDIENTE_PAGO') {
                    // Public view usually treats pending as booked/held
                    status = 'booked'
                }

                slots[dateStr].push({
                    startTime,
                    endTime,
                    status,
                })
            }
        })

        // Add blocks as booked slots
        blocks?.forEach((block) => {
            const dateStr = formatInTimeZone(block.start_at, TIME_ZONE, 'yyyy-MM-dd')
            const startTime = formatInTimeZone(block.start_at, TIME_ZONE, 'HH:mm')
            // const endTime = ...

            if (slots[dateStr]) {
                slots[dateStr].push({
                    startTime,
                    endTime: '', // Block doesn't strictly need end time for simple 'booked' check usually, but good to have
                    status: 'booked',
                })
            }
        })

        return NextResponse.json({ slots })
    } catch (error) {
        console.error('Error in week availability:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
