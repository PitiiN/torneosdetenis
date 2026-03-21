
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

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
    console.log('Fetching field IDs...')

    // 1. Get Field IDs
    const { data: fields, error: fieldsError } = await supabase
        .from('fields')
        .select('id, name')
        .in('name', ['Huelén 7', 'Tabancura 6'])

    if (fieldsError || !fields) {
        console.error('Error fetching fields:', fieldsError)
        return
    }

    const huelen = fields.find(f => f.name === 'Huelén 7')
    const tabancura = fields.find(f => f.name === 'Tabancura 6')

    if (!huelen) console.error('Huelén 7 not found')
    if (!tabancura) console.error('Tabancura 6 not found')

    // 2. Update Huelén 7 -> PENDIENTE_PAGO
    if (huelen) {
        console.log(`Updating bookings for ${huelen.name} (${huelen.id}) to PENDIENTE_PAGO...`)
        const { count, error } = await supabase
            .from('bookings')
            .update({ status: 'PENDIENTE_PAGO' })
            .eq('field_id', huelen.id)
            .select('*', { count: 'exact' })

        if (error) console.error('Error updating Huelén:', error)
        else console.log(`Updated ${count} bookings for Huelén 7.`)
    }

    // 3. Update Tabancura 6 -> CANCELADA
    if (tabancura) {
        console.log(`Updating bookings for ${tabancura.name} (${tabancura.id}) to CANCELADA...`)
        const { count, error } = await supabase
            .from('bookings')
            .update({ status: 'CANCELADA' })
            .eq('field_id', tabancura.id)
            .select('*', { count: 'exact' })

        if (error) console.error('Error updating Tabancura:', error)
        else console.log(`Updated ${count} bookings for Tabancura 6.`)
    }
}

run()
