
import { createClient } from '@supabase/supabase-js'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const TIME_ZONE = 'America/Santiago'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function run() {
    const fieldId = '6e848dc8-f3e9-4d05-bce8-8b54d843c1e3' // Tabancura 6
    const startDate = '2026-02-09'
    const endDate = '2026-02-15'

    console.log(`Checking availability for Field ${fieldId} from ${startDate} to ${endDate}`)

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
    bookingsData.forEach(b => console.log(`- ID: ${b.id}, Status: ${b.status}, Start: ${b.start_at}`))

    // Aggregation Logic check
    const slots: Record<string, any[]> = {}
    const days = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate),
    })

    days.forEach((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        slots[dateStr] = []
    })

    bookingsData.forEach((booking) => {
        // Status Normalization
        let status = 'booked'
        const rawStatus = (booking.status || '').trim().toUpperCase()

        if (rawStatus === 'BLOQUEADA') {
            status = 'blocked'
        } else if (rawStatus === 'PENDIENTE_PAGO') {
            status = 'booked'
        }

        const dateStr = formatInTimeZone(booking.start_at, TIME_ZONE, 'yyyy-MM-dd')
        const startTime = formatInTimeZone(booking.start_at, TIME_ZONE, 'HH:mm')

        console.log(`Processing ${booking.id}: matches date ${dateStr} at ${startTime} with status ${status}`)

        if (slots[dateStr]) {
            slots[dateStr].push({ startTime, status })
        } else {
            console.warn(`Date slot ${dateStr} not initialized!`)
        }
    })

    console.log('Final Slots for 2026-02-09:')
    console.log(JSON.stringify(slots['2026-02-09'], null, 2))
}

run()
