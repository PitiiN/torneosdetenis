
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Read env manually
const envPath = path.resolve(__dirname, '../.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=')
    if (key && value) {
        acc[key.trim()] = value.trim()
    }
    return acc
}, {} as Record<string, string>)

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
    console.log('Searching for Tabancura 6 booking on Feb 16 2026...')

    // Find Tabancura 6 ID
    const { data: fields } = await supabase.from('fields').select('id').eq('name', 'Tabancura 6').single()
    if (!fields) {
        console.error('Court not found')
        return
    }

    // Find Booking
    // ISO Date check: 2026-02-17 UTC (which is Feb 16 22:00 Chile)
    const targetDate = '2026-02-17'

    // We need to match the start_at LIKE '2026-02-16%'
    const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('field_id', fields.id)
        .ilike('start_at', `${targetDate}%`)

    if (!bookings || bookings.length === 0) {
        console.error('No booking found for that date.')
        return
    }

    const booking = bookings[0] // Assume first one
    console.log(`Found booking: ${booking.id} at ${booking.start_at}`)

    // Update to PENDIENTE_PAGO and NOW
    const { error } = await supabase
        .from('bookings')
        .update({
            status: 'PENDIENTE_PAGO',
            created_at: new Date().toISOString() // Reset timer
        })
        .eq('id', booking.id)

    if (error) console.error('Error updating:', error)
    else console.log('Booking set to PENDIENTE_PAGO with fresh timer.')
}

run()
