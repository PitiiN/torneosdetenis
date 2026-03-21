import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format, parseISO, eachDayOfInterval } from 'date-fns'

interface BookingRecord {
    id: string
    start_at: string
    end_at: string
    status: string
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
            .select('id, start_at, end_at, status')
            .eq('field_id', fieldId)
            .gte('start_at', `${startDate}T00:00:00`)
            .lte('start_at', `${endDate}T23:59:59`)
            .in('status', ['PENDIENTE_PAGO', 'EN_VERIFICACION', 'PAGADA'])

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
        const slots: Record<string, { startTime: string; endTime: string; status: 'booked' }[]> = {}

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
            const bookingStart = parseISO(booking.start_at)
            const dateStr = format(bookingStart, 'yyyy-MM-dd')
            const startTime = format(bookingStart, 'HH:mm')
            const endTime = format(parseISO(booking.end_at), 'HH:mm')

            if (slots[dateStr]) {
                const isPending = booking.status === 'PENDIENTE_PAGO'
                slots[dateStr].push({
                    startTime,
                    endTime,
                    status: isPending ? 'pending' : 'booked',
                })
            }
        })

        // Add blocks as booked slots
        blocks?.forEach((block) => {
            const blockStart = parseISO(block.start_at)
            const dateStr = format(blockStart, 'yyyy-MM-dd')
            const startTime = format(blockStart, 'HH:mm')
            const endTime = format(parseISO(block.end_at), 'HH:mm')

            if (slots[dateStr]) {
                slots[dateStr].push({
                    startTime,
                    endTime,
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
