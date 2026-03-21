import { createClient } from '@supabase/supabase-js'

// Hardcoded for this one-time fix
const supabaseUrl = 'https://wlzqcrrkmaoqjqpkmigh.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsenFjcnJrbWFvcWpxcGttaWdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNTc4NCwiZXhwIjoyMDg1ODExNzg0fQ.keR_1hSSn6pCckYcZhOwE3BowsA09caClf78mjRdhvw'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixTimezones() {
    console.log('Fetching all bookings...')

    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, start_at, end_at')

    if (error) {
        console.error('Error fetching bookings:', error)
        return
    }

    if (!bookings || bookings.length === 0) {
        console.log('No bookings found')
        return
    }

    console.log(`Found ${bookings.length} bookings to fix`)

    for (const booking of bookings) {
        // Add 3 hours to fix the UTC offset issue
        const startAt = new Date(booking.start_at)
        const endAt = new Date(booking.end_at)

        // Add 3 hours (Chile is UTC-3 in summer)
        startAt.setHours(startAt.getHours() + 3)
        endAt.setHours(endAt.getHours() + 3)

        const newStartAt = startAt.toISOString()
        const newEndAt = endAt.toISOString()

        console.log(`Fixing booking ${booking.id}:`)
        console.log(`  Old start: ${booking.start_at} -> New: ${newStartAt}`)

        const { error: updateError } = await supabase
            .from('bookings')
            .update({
                start_at: newStartAt,
                end_at: newEndAt
            })
            .eq('id', booking.id)

        if (updateError) {
            console.error(`  Error updating: ${updateError.message}`)
        } else {
            console.log(`  Updated successfully`)
        }
    }

    console.log('\nDone!')
}

fixTimezones()
