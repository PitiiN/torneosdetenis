import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
    console.log('Loading .env.local...')
    const envConfig = fs.readFileSync(envPath, 'utf-8')
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) {
            process.env[key.trim()] = value.trim()
        }
    })
} else {
    console.warn('.env.local not found!')
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing env vars')
    console.log('URL:', SUPABASE_URL)
    console.log('KEY:', SERVICE_ROLE_KEY ? 'Set' : 'Missing')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function resetAuth() {
    console.log('Starting Auth Reset...')

    // 1. List Users
    // Note: listUsers defaults to 50. Loop if needed, but for now we fetch a page.
    // Ideally we iterate until empty.
    let allUsers: any[] = []
    let page = 1
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })

    if (listError) {
        throw listError
    }
    allUsers = users
    console.log(`Found ${allUsers.length} users.`)

    // 2. Delete Users
    for (const user of allUsers) {
        console.log(`Deleting user: ${user.email} (${user.id})`)
        const { error } = await supabase.auth.admin.deleteUser(user.id)
        if (error) console.error(`Failed to delete ${user.email}:`, error)
    }

    // 3. Create Admin User
    const adminEmail = 'jaravena@f2sports.cl'
    const adminPassword = '007gatoS!'

    console.log(`Creating Admin User: ${adminEmail}`)
    let userId: string | undefined

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { full_name: 'Admin User' }
    })

    if (createError) {
        console.warn('Error creating user (might exist):', createError.message)
        // Try to find the user
        const { data: { users } } = await supabase.auth.admin.listUsers()
        const existing = users.find(u => u.email === adminEmail)
        if (existing) {
            console.log('User found, proceeding with setup:', existing.id)
            userId = existing.id
            // Update password just in case
            await supabase.auth.admin.updateUserById(userId, { password: adminPassword })
        } else {
            console.error('Could not create or find user.')
            return
        }
    } else if (newUser.user) {
        userId = newUser.user.id
        console.log(`Admin created. ID: ${userId}`)
    }

    if (!userId) return

    // 4. Create Profile (Manually, since trigger didn't exist when user created? 
    // Wait, DB reset runs BEFORE this script. 
    // Usually triggers run on INSERT to auth.users if defined?
    // But Supabase triggers on auth.users are tricky if not managed by Supabase internal.
    // 001_init.sql does NOT create a trigger on auth.users. It creates triggers on profiles/bookings.
    // So we MUST insert profile manually.

    console.log('Upserting Profile...')
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            full_name: 'Admin User',
            phone: '+56900000000'
        })

    if (profileError) {
        console.error('Error upserting profile:', profileError)
    }

    // 5. Assign Role
    console.log('Assigning ADMIN Role...')
    const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
            user_id: userId,
            role: 'ADMIN' // Enum value
        })

    if (roleError) {
        console.error('Error assigning role:', roleError)
    }

    console.log('Auth Reset Complete!')
}

resetAuth().catch(console.error)
