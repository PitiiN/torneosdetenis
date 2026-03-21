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
        const { bookingId, priceTotalCents } = body

        if (!bookingId || typeof priceTotalCents !== 'number') {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
        }

        // Update booking
        const adminClient = await createAdminClient()

        const { error: updateError } = await adminClient
            .from('bookings')
            .update({ price_total_cents: priceTotalCents })
            .eq('id', bookingId)

        if (updateError) {
            console.error('Error updating price:', updateError)
            return NextResponse.json({ error: 'Error al actualizar precio' }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Update price API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
