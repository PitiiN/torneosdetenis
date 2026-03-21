import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Read env manually
const envPath = path.resolve(__dirname, '../.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = envContent.split('\n').reduce((acc, line) => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
        acc[match[1].trim()] = match[2].trim()
    }
    return acc
}, {} as Record<string, string>)

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL']
const supabaseServiceKey = envVars['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

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
