
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
    console.log('Checking bookings...')
    const { data, error } = await supabase
        .from('bookings')
        .select('id, status, field:fields(name)')
        .limit(10)

    if (error) console.error(error)
    else console.log(JSON.stringify(data, null, 2))
}

run()
