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
        const status = searchParams.get('status')
        const fieldId = searchParams.get('fieldId')
        const summary = searchParams.get('summary') === 'true'

        // Use admin client to fetch all bookings
        const adminClient = await createAdminClient()

        let query = adminClient.from('bookings')

        // If summary mode, fetch minimal data without joins
        if (summary) {
            query = query.select('id, status, start_at, user_id, created_at')
        } else {
            // Full data with relations
            query = query.select(`
                *,
                field:fields(*),
                user:profiles(id, full_name, phone)
            `)
        }

        query = query.order('created_at', { ascending: false })

        if (status) {
            query = query.eq('status', status)
        }

        if (fieldId) {
            query = query.eq('field_id', fieldId)
        }

        const { data: bookings, error } = await query

        if (error) {
            console.error('Error fetching bookings:', error)
            return NextResponse.json(
                { error: 'Error al obtener reservas' },
                { status: 500 }
            )
        }

        return NextResponse.json({ bookings })
    } catch (error) {
        console.error('Admin bookings API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
