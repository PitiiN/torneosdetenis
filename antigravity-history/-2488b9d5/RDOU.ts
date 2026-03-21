import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { format, parseISO, eachDayOfInterval, addDays } from 'date-fns'
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
        const supabase = await createAdminClient()
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
            .lte('start_at', `${format(addDays(parseISO(endDate), 2), 'yyyy-MM-dd')}T00:00:00`) // Extend to +2 days to cover full timezone shifts (e.g. late Sunday in Chile = Monday morning UTC)
            .not('status', 'in', '("CANCELADA","EXPIRADA")')

        const bookings = bookingsData as BookingRecord[] | null

        if (error) {
            console.error('Error fetching bookings:', error)
            return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
        }

        // Get all blocks for this field in the date range
        const { data: blocksData } = await supabase
            .from('field_blocks')
            .select('id, start_at, end_at')
            .eq('field_id', fieldId)
            .gte('start_at', `${startDate}T00:00:00`)
            .lte('start_at', `${format(addDays(parseISO(endDate), 2), 'yyyy-MM-dd')}T00:00:00`)

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
            if (booking.status === 'PENDIENTE_PAGO' && booking.created_source !== 'admin') {
                const createdTime = new Date(booking.created_at).getTime()
                const now = Date.now()
                if (now - createdTime > 10 * 60 * 1000) {
                    return // Skip (expired)
                }
            }

            const dateStr = formatInTimeZone(booking.start_at, TIME_ZONE, 'yyyy-MM-dd')

            if (slots[dateStr]) {
                let status: 'booked' | 'pending' | 'blocked' = 'booked'
                const rawStatus = (booking.status || '').trim().toUpperCase()

                if (rawStatus === 'BLOQUEADA') {
                    status = 'blocked'
                } else if (rawStatus === 'PENDIENTE_PAGO') {
                    // Admin bookings in PENDING state should appear as BOOKED to users
                    if (booking.created_source === 'admin') {
                        status = 'booked'
                    } else {
                        status = 'pending'
                    }
                }

                // Parse start/end as absolute timestamps (parseISO handles timezone offsets correctly)
                const loopStartAbsolute = parseISO(booking.start_at)
                const loopEndAbsolute = parseISO(booking.end_at)
                let loopTime = loopStartAbsolute.getTime()
                const endTime = loopEndAbsolute.getTime()
                let iterations = 0

                while (loopTime < endTime && iterations < 100) { // Safety guard
                    const loopDate = new Date(loopTime)
                    const loopDateStr = formatInTimeZone(loopDate, TIME_ZONE, 'yyyy-MM-dd')
                    const loopStartTime = formatInTimeZone(loopDate, TIME_ZONE, 'HH:mm')

                    if (slots[loopDateStr]) {
                        slots[loopDateStr].push({
                            startTime: loopStartTime,
                            endTime: '',
                            status,
                        })
                    }
                    loopTime += 30 * 60000 // Add 30 mins in milliseconds
                    iterations++
                }
            }
        })

        // Add blocks as BLOCKED slots
        blocks?.forEach((block) => {
            let loopTime = new Date(block.start_at)
            const loopEnd = new Date(block.end_at)
            let iterations = 0

            // Iterate in 30-minute intervals
            while (loopTime < loopEnd && iterations < 100) { // Safety guard
                const dateStr = formatInTimeZone(loopTime, TIME_ZONE, 'yyyy-MM-dd')
                const startTime = formatInTimeZone(loopTime, TIME_ZONE, 'HH:mm')

                if (slots[dateStr]) {
                    slots[dateStr].push({
                        startTime,
                        endTime: '',
                        status: 'blocked',
                    })
                }

                // Increment by 30 minutes
                loopTime = new Date(loopTime.getTime() + 30 * 60000)
                iterations++
            }
        })

        return NextResponse.json({ slots })
    } catch (error) {
        console.error('Error in week availability:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
