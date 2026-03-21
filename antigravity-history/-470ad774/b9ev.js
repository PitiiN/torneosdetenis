
const { createClient } = require('@supabase/supabase-js')
const { format, parseISO, eachDayOfInterval } = require('date-fns')
const { formatInTimeZone } = require('date-fns-tz')

const TIME_ZONE = 'America/Santiago'
const SUPABASE_URL = 'https://wlzqcrrkmaoqjqpkmigh.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsenFjcnJrbWFvcWpxcGttaWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzU3ODQsImV4cCI6MjA4NTgxMTc4NH0.31QWL1oUTu-oW-sAFtyV48C5198kbIR8KI2lO1eRwl8'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function run() {
    const fieldId = '6e848dc8-f3e9-4d05-bce8-8b54d843c1e3' // Tabancura 6
    const startDate = '2026-02-09'
    const endDate = '2026-02-15'

    console.log(`Checking availability for Field ${fieldId} from ${startDate} to ${endDate}`)

    // Get all bookings for this field in the date range
    const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select('id, start_at, end_at, status, created_at, created_source')
        .eq('field_id', fieldId)
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${endDate}T23:59:59`)

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log('Raw Bookings found:', bookingsData.length)
    bookingsData.forEach(b => console.log(`- ID: ${b.id}, Status: '${b.status}', Start: ${b.start_at}`))

    // Aggregation Logic check
    const slots = {}
    const days = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate),
    })

    days.forEach((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        slots[dateStr] = []
    })

    if (bookingsData) {
        bookingsData.forEach((booking) => {
            // Status Normalization
            let status = 'booked'
            const rawStatus = (booking.status || '').trim().toUpperCase()

            if (rawStatus === 'BLOQUEADA') {
                status = 'blocked'
            } else if (rawStatus === 'PENDIENTE_PAGO') {
                status = 'booked'
            }

            // Convert UTC to 'America/Santiago' for display
            // Note: In Node, formatInTimeZone works reliably.
            const dateStr = formatInTimeZone(booking.start_at, TIME_ZONE, 'yyyy-MM-dd')
            const startTime = formatInTimeZone(booking.start_at, TIME_ZONE, 'HH:mm')

            console.log(`Processing ${booking.id}: start_at=${booking.start_at} => dateStr=${dateStr}, startTime=${startTime}, status=${status}`)

            if (slots[dateStr]) {
                const existing = slots[dateStr].find(s => s.startTime === startTime)
                if (existing) {
                    console.warn(`Duplicate slot found for ${dateStr} ${startTime}. Existing: ${existing.status}, New: ${status}`)
                }

                slots[dateStr].push({
                    startTime,
                    status,
                })
            } else {
                console.warn(`Date slot ${dateStr} not initialized!`)
            }
        })
    }

    console.log('Final Slots for 2026-02-09:')
    console.log(JSON.stringify(slots['2026-02-09'], null, 2))
}

run()
