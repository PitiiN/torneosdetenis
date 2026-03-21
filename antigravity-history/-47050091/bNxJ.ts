
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load env 
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugFieldUsers() {
    console.log('--- Debugging Field Users Query ---')

    // Simulate params: Month = 2026-02, Field = Huelen 7 (need ID)
    const month = '2026-02'

    // First get field ID for 'Huelén 7'
    const { data: fields } = await supabase.from('fields').select('id, name').ilike('name', '%Huelén 7%').single()
    if (!fields) {
        console.error('Field not found')
        return
    }
    const fieldId = fields.id
    console.log(`Field: ${fields.name} (${fieldId})`)
    console.log(`Month: ${month}`)

    // Date Range Logic from route.ts
    const [year, monthIndex] = month.split('-').map(Number)
    const startDate = new Date(year, monthIndex - 1, 1)
    const endDate = new Date(year, monthIndex, 1) // 2026-03-01

    console.log(`Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Query to check raw data
    const query = supabase
        .from('bookings')
        .select('*')
        .eq('field_id', fieldId)
        .gte('start_at', startDate.toISOString())
        .lt('start_at', endDate.toISOString())
        .limit(5)

    const { data: bookings, error } = await query

    if (error) {
        console.error('Query Error:', error)
    } else {
        console.log(`Found ${bookings?.length} bookings`)
        if (bookings && bookings.length > 0) {
            bookings.forEach(b => {
                console.log('--- Booking ---')
                console.log(`ID: ${b.id}`)
                console.log(`Status: ${b.status}`)
                console.log(`Price Total: ${b.price_total}`)
                console.log(`Price Total Cents: ${b.price_total_cents}`)
                console.log(`User ID: ${b.user_id}`)
                console.log(`Verification Note: ${b.verification_note}`)
            })

            // Check profiles for these users
            const userIds = bookings.map(b => b.user_id).filter(Boolean)
            if (userIds.length > 0) {
                const { data: profiles, error: pError } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', userIds)

                console.log('--- Profiles found ---')
                console.log(profiles)
            }
        }
    }
}

debugFieldUsers()
