import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addMinutes, parseISO, format, setHours, setMinutes, startOfDay, isBefore, isAfter } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const fieldId = searchParams.get('fieldId')
        const dateStr = searchParams.get('date')

        if (!fieldId || !dateStr) {
            return NextResponse.json(
                { error: 'fieldId and date are required' },
                { status: 400 }
            )
        }

        const supabase = await createClient()
        const timezone = 'America/Santiago'
        const date = parseISO(dateStr)
        const dayOfWeek = date.getDay() // 0 = Sunday

        // Get field info
        const { data: field, error: fieldError } = await supabase
            .from('fields')
            .select('*')
            .eq('id', fieldId)
            .single()

        if (fieldError || !field) {
            return NextResponse.json(
                { error: 'Field not found' },
                { status: 404 }
            )
        }

        // Get schedule for this day
        const { data: schedules } = await supabase
            .from('field_schedules')
            .select('*')
            .eq('field_id', fieldId)
            .eq('day_of_week', dayOfWeek)
            .eq('is_active', true)

        if (!schedules || schedules.length === 0) {
            return NextResponse.json({
                field,
                date: dateStr,
                slots: [],
                message: 'No schedule for this day',
            })
        }

        // Get bookings for this day that block slots
        const dayStart = startOfDay(date)
        const dayEnd = new Date(dayStart)
        dayEnd.setDate(dayEnd.getDate() + 1)

        const { data: bookings } = await supabase
            .from('bookings')
            .select('id, start_at, end_at, status')
            .eq('field_id', fieldId)
            .gte('start_at', dayStart.toISOString())
            .lt('start_at', dayEnd.toISOString())
            .in('status', ['PENDIENTE_PAGO', 'EN_VERIFICACION', 'PAGADA', 'BLOQUEADA'])

        // Get blocks for this day
        const { data: blocks } = await supabase
            .from('field_blocks')
            .select('id, start_at, end_at')
            .eq('field_id', fieldId)
            .gte('start_at', dayStart.toISOString())
            .lt('start_at', dayEnd.toISOString())

        // Generate slots based on schedule
        const slots: {
            startTime: string
            endTime: string
            startAt: string
            endAt: string
            available: boolean
            bookingId?: string
            blockId?: string
        }[] = []

        const typedField = field as { slot_duration_minutes?: number }
        const slotDuration = typedField.slot_duration_minutes || 60

        const typedSchedules = schedules as { start_time: string; end_time: string }[]
        for (const schedule of typedSchedules) {
            // Parse schedule times
            const [startHour, startMinute] = schedule.start_time.split(':').map(Number)
            const [endHour, endMinute] = schedule.end_time.split(':').map(Number)

            let slotStart = setMinutes(setHours(date, startHour), startMinute)
            const scheduleEnd = setMinutes(setHours(date, endHour), endMinute)

            while (isBefore(addMinutes(slotStart, slotDuration), scheduleEnd) ||
                addMinutes(slotStart, slotDuration).getTime() === scheduleEnd.getTime()) {
                const slotEnd = addMinutes(slotStart, slotDuration)

                // Check if slot is blocked by a booking
                const blockingBooking = (bookings || []).find(b => {
                    const bookingStart = parseISO(b.start_at)
                    const bookingEnd = parseISO(b.end_at)
                    return (
                        (isAfter(slotStart, bookingStart) || slotStart.getTime() === bookingStart.getTime()) &&
                        isBefore(slotStart, bookingEnd)
                    ) || (
                            isAfter(slotEnd, bookingStart) &&
                            (isBefore(slotEnd, bookingEnd) || slotEnd.getTime() === bookingEnd.getTime())
                        ) || (
                            (isBefore(slotStart, bookingStart) || slotStart.getTime() === bookingStart.getTime()) &&
                            (isAfter(slotEnd, bookingEnd) || slotEnd.getTime() === bookingEnd.getTime())
                        )
                })

                // Check if slot is blocked by an admin block
                const blockingBlock = (blocks || []).find(b => {
                    const blockStart = parseISO(b.start_at)
                    const blockEnd = parseISO(b.end_at)
                    return (
                        (isAfter(slotStart, blockStart) || slotStart.getTime() === blockStart.getTime()) &&
                        isBefore(slotStart, blockEnd)
                    ) || (
                            isAfter(slotEnd, blockStart) &&
                            (isBefore(slotEnd, blockEnd) || slotEnd.getTime() === blockEnd.getTime())
                        )
                })

                slots.push({
                    startTime: format(slotStart, 'HH:mm'),
                    endTime: format(slotEnd, 'HH:mm'),
                    startAt: slotStart.toISOString(),
                    endAt: slotEnd.toISOString(),
                    available: !blockingBooking && !blockingBlock,
                    bookingId: blockingBooking?.id,
                    blockId: blockingBlock?.id,
                })

                slotStart = slotEnd
            }
        }

        return NextResponse.json({
            field,
            date: dateStr,
            slots,
        })
    } catch (error) {
        console.error('Availability API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
