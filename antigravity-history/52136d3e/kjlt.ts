import { SupabaseClient } from '@supabase/supabase-js'

export async function ensureAdminUser(supabase: SupabaseClient) {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        throw new Error('Unauthorized')
    }

    const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

    const role = userRole?.role

    if (role !== 'ADMIN') {
        throw new Error('Forbidden')
    }

    return user
}
