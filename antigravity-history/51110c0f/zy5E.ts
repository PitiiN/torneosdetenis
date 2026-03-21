
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

async function reassign() {
    console.log('🔄 Reassigning bookings...')

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

    // 1. Get IDs
    const { data: users } = await supabase.from('profiles').select('id, email, full_name').in('email', ['javier.aravena25@gmail.com', 'usuario@test.com'])

    if (!users || users.length < 2) {
        // Fallback: search by partial info or list all if small
        console.log('Could not find specific emails. Listing all:')
        const { data: all } = await supabase.from('profiles').select('id, email, full_name')
        console.log(all)
        // Try to identify manually from previous log:
        // Javier: 2c469b8f-7490-4313-a8ba-71c68bbd9b99
        // Test: 4c169cc3-e90b-4905-bd94-bcf014e022f2
    }

    // Hardcode from previous diagnostic to be safe
    const javierId = '2c469b8f-7490-4313-a8ba-71c68bbd9b99'
    const testId = '4c169cc3-e90b-4905-bd94-bcf014e022f2'

    // 2. Update
    console.log(`Moving bookings from ${javierId} to ${testId}...`)

    const { error, count } = await supabase
        .from('bookings')
        .update({ user_id: testId })
        .eq('user_id', javierId)
        .select('*', { count: 'exact' })

    if (error) {
        console.error('Error updating:', error)
    } else {
        console.log(`✅ Moved ${count} bookings.`)
    }
}

reassign().catch(console.error)
