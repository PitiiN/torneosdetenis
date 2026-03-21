import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Get current user and check admin
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        const typedRole = userRole as { role: string } | null
        if (!typedRole || typedRole.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Get body
        const body = await request.json()
        const { bookingIds, status } = body

        if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0 || !status) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
        }

        // Update bookings
        const adminClient = await createAdminClient()

        const { error: updateError } = await adminClient
            .from('bookings')
            .update({ status: status } as any)
            .in('id', bookingIds)

        if (updateError) {
            console.error('Error updating status:', updateError)
            return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Bulk status API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
