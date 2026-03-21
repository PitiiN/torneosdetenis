
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

    // Query from route.ts
    let query = supabase
        .from('bookings')
        .select(`
            id,
            user_id,
            status,
            start_at,
            price_total_cents,
            field:fields(name),
            user:profiles(id, full_name, phone)
        `)
        .neq('status', 'CANCELADA')
        .neq('status', 'EXPIRADA')
        .eq('field_id', fieldId)
        .gte('start_at', startDate.toISOString())
        .lt('start_at', endDate.toISOString())

    const { data: bookings, error } = await query

    if (error) {
        console.error('Query Error:', error)
    } else {
        console.log(`Found ${bookings?.length} bookings`)
        if (bookings && bookings.length > 0) {
            console.log('Sample Booking:', JSON.stringify(bookings[0], null, 2))
        }
    }
}

debugFieldUsers()
