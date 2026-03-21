
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

async function findJavier() {
    console.log('🕵️ Searching for Javier...')

    // Load Env (Windows friendly)
    const envPath = path.resolve(process.cwd(), '.env.local')
    let envVars: Record<string, string> = {}

    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8')
        envVars = envContent.split('\n').reduce((acc, line) => {
            const [key, val] = line.split('=')
            if (key && val) {
                const cleanVal = val.trim().replace(/^["']|["']$/g, '')
                acc[key.trim()] = cleanVal
            }
            return acc
        }, {} as Record<string, string>)
    } else {
        console.error('❌ .env.local not found at', envPath)
        return
    }

    const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL']
    const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY']

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials in .env.local')
        return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Search specific
    console.log('\n🔍 Searching "Javier" in profiles (full_name ilike)...')
    const { data: javiers, error: searchError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%Javier%')

    if (searchError) console.error('Error searching:', searchError)
    else {
        console.log(`Found ${javiers?.length} Javiers:`)
        javiers?.forEach(p => console.log(JSON.stringify(p, null, 2)))
    }

    // 2. List recent users
    console.log('\n📋 Listing recent 10 profiles:')
    const { data: allUsers, error: listError } = await supabase
        .from('profiles')
        .select('*')
        .limit(10)

    if (listError) console.error('Error listing:', listError)
    else {
        allUsers?.forEach(p => console.log(` - ${p.full_name} [${p.id}] Phone: ${p.phone}`))
    }
}

findJavier().catch(console.error)
