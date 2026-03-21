import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Check if user is admin
        const { data: userRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        const typedRole = userRole as { role: string } | null
        if (!typedRole || typedRole.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            )
        }

        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q') || ''

        // Use admin client
        const adminClient = await createAdminClient()

        // Search users
        let usersQuery = adminClient
            .from('profiles')
            .select('id, full_name, email, phone')
            .order('full_name', { ascending: true })
            .limit(50)

        if (query) {
            usersQuery = usersQuery.or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        }

        const { data: users, error } = await usersQuery

        if (error) {
            console.error('Error fetching users:', error)
            return NextResponse.json(
                { error: 'Error al buscar usuarios' },
                { status: 500 }
            )
        }

        return NextResponse.json({ users })
    } catch (error) {
        console.error('Users API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
