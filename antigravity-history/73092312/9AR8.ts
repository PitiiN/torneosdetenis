
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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
    const { data: fields } = await supabase.from('fields').select('id').eq('name', 'Tabancura 6').single()
    const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('field_id', fields?.id)
        .order('start_at', { ascending: true })
        .limit(20)

    console.log(bookings?.map(b => b.start_at))
}
run()
