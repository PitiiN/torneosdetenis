
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

async function seed() {
    console.log('🌱 Starting corrected seed process...')

    const envPath = path.resolve(process.cwd(), '.env.local')
    const envVars = fs.readFileSync(envPath, 'utf-8').split('\n').reduce((acc, line) => {
        const [key, val] = line.split('=')
        if (key && val) acc[key.trim()] = val.trim().replace(/^["']|["']$/g, '')
        return acc
    }, {} as Record<string, string>)

    const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL']
    const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY']

    const supabase = createClient(supabaseUrl, supabaseKey!)

    // 1. Clear Bookings
    console.log('🗑️  Deleting all bookings...')
    await supabase.from('bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // 2. Target User (usuario@test.com)
    const userId = '4c169cc3-e90b-4905-bd94-bcf014e022f2' // Hardcoded from diagnosis
    console.log(`Using user ID: ${userId}`)

    // 3. Get Fields
    const { data: fields } = await supabase.from('fields').select('id, name')
    const getFieldId = (namePart: string) => fields?.find(f => f.name.includes(namePart))?.id

    const huelen7Id = getFieldId('Huelen 7') || getFieldId('Huelén 7')
    const huelen5Id = getFieldId('Huelen 5') || getFieldId('Huelén 5')
    const tabancura6Id = getFieldId('Tabancura 6')

    if (!huelen7Id || !huelen5Id || !tabancura6Id) {
        console.error('Missing fields')
        process.exit(1)
    }

    // 4. Insert with Offset -03:00
    // Huelen 7: Fridays 19:30
    const bookings = []
    const fridays = ['2026-02-06', '2026-02-13', '2026-02-20', '2026-02-27']
    fridays.forEach(date => {
        bookings.push({
            user_id: userId,
            field_id: huelen7Id,
            start_at: `${date}T19:30:00-03:00`,
            end_at: `${date}T20:30:00-03:00`,
            duration_minutes: 60,
            status: 'PAGADA',
            created_source: 'seed_v2'
        })
    })

    // Huelen 5: Saturdays 09:30
    const saturdays = ['2026-02-07', '2026-02-14', '2026-02-21', '2026-02-28']
    saturdays.forEach(date => {
        bookings.push({
            user_id: userId,
            field_id: huelen5Id,
            start_at: `${date}T09:30:00-03:00`,
            end_at: `${date}T10:30:00-03:00`,
            duration_minutes: 60,
            status: 'PAGADA',
            created_source: 'seed_v2'
        })
    })

    // Tabancura 6: Mondays (from 9th) 22:00
    const mondays = ['2026-02-09', '2026-02-16', '2026-02-23']
    mondays.forEach(date => {
        bookings.push({
            user_id: userId,
            field_id: tabancura6Id,
            start_at: `${date}T22:00:00-03:00`,
            end_at: `${date}T23:00:00-03:00`,
            duration_minutes: 60,
            status: 'PAGADA',
            created_source: 'seed_v2'
        })
    })

    console.log(`Inserting ${bookings.length} bookings...`)
    const { error } = await supabase.from('bookings').insert(bookings)
    if (error) console.error(error)
    else console.log('✅ Done!')
}

seed().catch(console.error)
