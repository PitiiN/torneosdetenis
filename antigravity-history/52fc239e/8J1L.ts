
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

async function seed() {
    console.log('🌱 Starting seed process...')

    // 1. Read .env.local
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env.local not found')
        process.exit(1)
    }

    const envContent = fs.readFileSync(envPath, 'utf-8')
    const envVars = envContent.split('\n').reduce((acc, line) => {
        const [key, val] = line.split('=')
        if (key && val) {
            // Remove quotes if present
            const cleanVal = val.trim().replace(/^["']|["']$/g, '')
            acc[key.trim()] = cleanVal
        }
        return acc
    }, {} as Record<string, string>)

    const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL']
    const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY']

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials in .env.local')
        console.log('Keys found:', Object.keys(envVars))
        process.exit(1)
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 2. Clear Bookings
    console.log('🗑️  Deleting all bookings...')
    const { error: deleteError } = await supabase.from('bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000') // Trick to delete all
    if (deleteError) {
        console.error('Error deleting bookings:', deleteError)
        process.exit(1)
    }

    // 3. Get User
    console.log('👤 Fetching a user...')
    const { data: user, error: userError } = await supabase.from('profiles').select('id, full_name').limit(1).single()
    if (userError || !user) {
        console.error('Error fetching user:', userError)
        process.exit(1)
    }
    console.log(`Using user: ${user.full_name || 'Unknown'} (${user.id})`)

    // 4. Get Fields
    console.log('🏟️  Fetching fields...')
    const { data: fields, error: fieldsError } = await supabase.from('fields').select('id, name')
    if (fieldsError || !fields) {
        console.error('Error fetching fields:', fieldsError)
        process.exit(1)
    }

    const getFieldId = (namePart: string) => {
        const f = fields.find(f => f.name.includes(namePart))
        if (!f) console.error(`⚠️ Field not found for "${namePart}"`)
        return f?.id
    }

    const huelen7Id = getFieldId('Huelen 7') || getFieldId('Huelén 7')
    const huelen5Id = getFieldId('Huelen 5') || getFieldId('Huelén 5')
    const tabancura6Id = getFieldId('Tabancura 6')

    if (!huelen7Id || !huelen5Id || !tabancura6Id) {
        console.error('Could not find all fields. Available:', fields.map(f => f.name))
        process.exit(1)
    }

    // 5. Build Inserts
    const bookings = []

    // Huelen 7: Fridays 19:30
    const fridays = ['2026-02-06', '2026-02-13', '2026-02-20', '2026-02-27']
    fridays.forEach(date => {
        bookings.push({
            user_id: user.id,
            field_id: huelen7Id,
            start_at: `${date}T19:30:00`,
            end_at: `${date}T20:30:00`, // 60 mins
            duration_minutes: 60,
            status: 'PENDIENTE_PAGO',
            created_source: 'seed'
        })
    })

    // Huelen 5: Saturdays 09:30
    const saturdays = ['2026-02-07', '2026-02-14', '2026-02-21', '2026-02-28']
    saturdays.forEach(date => {
        bookings.push({
            user_id: user.id,
            field_id: huelen5Id,
            start_at: `${date}T09:30:00`,
            end_at: `${date}T10:30:00`,
            duration_minutes: 60,
            status: 'PENDIENTE_PAGO',
            created_source: 'seed'
        })
    })

    // Tabancura 6: Mondays (from 9th) 22:00
    const mondays = ['2026-02-09', '2026-02-16', '2026-02-23']
    mondays.forEach(date => {
        bookings.push({
            user_id: user.id,
            field_id: tabancura6Id,
            start_at: `${date}T22:00:00`,
            end_at: `${date}T23:00:00`,
            duration_minutes: 60,
            status: 'PENDIENTE_PAGO',
            created_source: 'seed'
        })
    })

    console.log(`💾 Inserting ${bookings.length} bookings...`)
    const { error: insertError } = await supabase.from('bookings').insert(bookings)

    if (insertError) {
        console.error('Error inserting bookings:', insertError)
    } else {
        console.log('✅ Seed completed successfully!')
    }
}

seed().catch(console.error)
