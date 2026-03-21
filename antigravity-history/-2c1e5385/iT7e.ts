
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

async function diagnose() {
    console.log('🕵️ Starting diagnosis...')

    const envPath = path.resolve(process.cwd(), '.env.local')
    const envContent = fs.readFileSync(envPath, 'utf-8')
    const envVars = envContent.split('\n').reduce((acc, line) => {
        const [key, val] = line.split('=')
        if (key && val) {
            const cleanVal = val.trim().replace(/^["']|["']$/g, '')
            acc[key.trim()] = cleanVal
        }
        return acc
    }, {} as Record<string, string>)

    const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL']
    const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY']

    const supabase = createClient(supabaseUrl, supabaseKey!)

    // 1. List Users
    console.log('\n👥 Users in Profiles:')
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email')
    if (profiles) {
        profiles.forEach(p => console.log(` - ${p.full_name} (${p.email || 'no-email'}) [${p.id}]`))
    }

    // 2. Count Bookings
    console.log('\n📚 Booking Counts:')
    const { data: bookings } = await supabase.from('bookings').select('user_id, status, start_at')

    const counts = {} as Record<string, number>
    bookings?.forEach(b => {
        counts[b.user_id] = (counts[b.user_id] || 0) + 1
    })

    Object.entries(counts).forEach(([uid, count]) => {
        const name = profiles?.find(p => p.id === uid)?.full_name || 'Unknown'
        console.log(` - User ${name} (${uid}): ${count} bookings`)
    })

    // 3. Check Specific Dates (Feb 2026)
    console.log('\n📅 Checking Feb 2026 Bookings:')
    const febBookings = bookings?.filter(b => b.start_at.startsWith('2026-02'))
    if (febBookings?.length === 0) {
        console.log('⚠️ No bookings found for Feb 2026!')
    } else {
        console.log(`Found ${febBookings?.length} bookings for Feb 2026.`)
        febBookings?.forEach(b => console.log(`   - ${b.start_at} (${b.status}) User: ${b.user_id}`))
    }

}

diagnose().catch(console.error)
