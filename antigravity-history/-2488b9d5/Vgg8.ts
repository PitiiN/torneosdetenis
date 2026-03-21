import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
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
            .lte('start_at', `${endDate}T23:59:59`)
            .not('status', 'in', '("CANCELADA","EXPIRADA")')

        const bookings = bookingsData as BookingRecord[] | null

        if (error) {
            console.error('Error fetching bookings:', error)
            return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
        }

        // Get all blocks for this field in the date range
        // Get all blocks for this field in the date range
        const { data: blocksData } = await supabase
            .from('field_blocks')
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
            if (booking.status === 'PENDIENTE_PAGO' && booking.created_source !== 'admin') {
                const createdTime = new Date(booking.created_at).getTime()
                const now = Date.now()
                if (now - createdTime > 10 * 60 * 1000) {
                    return // Skip (expired)
                }
            }

            // Bookings usually align with slots, but let's handle duration just in case
            // For now, assuming bookings define occupied slots by their start time as per existing logic,
            // BUT strict logic would be better. Let's keep existing booking logic for now to avoid regression,
            // or improve it if needed. The previous code just pushed startAt.
            // Let's stick to the previous simple logic for bookings if it was working for single slots,
            // OR improve it to cover duration too. 
            // Given the user complaints were about BLOCKS not showing, let's focus on fixing BLOCKS.

            const dateStr = formatInTimeZone(booking.start_at, TIME_ZONE, 'yyyy-MM-dd')
            const startTime = formatInTimeZone(booking.start_at, TIME_ZONE, 'HH:mm')
            const endTime = formatInTimeZone(booking.end_at, TIME_ZONE, 'HH:mm')

            if (slots[dateStr]) {
                let status: 'booked' | 'pending' | 'blocked' = 'booked'
                const rawStatus = (booking.status || '').trim().toUpperCase()

                if (rawStatus === 'BLOQUEADA') {
                    status = 'blocked'
                } else if (rawStatus === 'PENDIENTE_PAGO') {
                    status = 'booked' // Show as booked/arrendada publicly
                }

                // If booking spans multiple slots (e.g. 90 mins), we should block all of them.
                // However, without knowing the slot interval here (30 or 60), it's tricky.
                // But the frontend iterates through validTimeSlots. `getSlotStatus` checks if ANY slot in `weekData` matches the time.
                // So we MUST generate an entry for every valid start time covered by this booking/block.

                // Let's loop every 30 mins from start to end
                let loopTime = new Date(booking.start_at)
                const loopEnd = new Date(booking.end_at)

                while (loopTime < loopEnd) {
                    const loopDateStr = formatInTimeZone(loopTime, TIME_ZONE, 'yyyy-MM-dd')
                    const loopStartTime = formatInTimeZone(loopTime, TIME_ZONE, 'HH:mm')

                    if (slots[loopDateStr]) {
                        // Avoid duplicates if multiple 30min steps land on same slot (unlikely if loop matches slot size)
                        // Check existence? No, frontend `some` check handles multiple entries fine.
                        slots[loopDateStr].push({
                            startTime: loopStartTime,
                            endTime: '',
                            status,
                        })
                    }
                    loopTime = new Date(loopTime.getTime() + 30 * 60000) // Add 30 mins
                }
            }
        })

        // Add blocks as BLOCKED slots
        // Iterate through the block duration to cover all potential slots
        blocks?.forEach((block) => {
            let loopTime = new Date(block.start_at)
            const loopEnd = new Date(block.end_at)

            // Iterate in 30-minute intervals
            while (loopTime < loopEnd) {
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
            }
        })

        return NextResponse.json({ slots })
    } catch (error) {
        console.error('Error in week availability:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
