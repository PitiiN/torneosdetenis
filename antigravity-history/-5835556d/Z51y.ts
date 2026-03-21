import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema for bulk cancellation
const bulkCancelSchema = z.object({
    bookingIds: z.array(z.string().uuid()).min(1, 'Se requiere al menos una reserva'),
})

export async function POST(request: NextRequest) {
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

        const body = await request.json()

        // Validate input
        const validation = bulkCancelSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            )
        }

        const { bookingIds } = validation.data

        // Use admin client for the update
        const adminClient = await createAdminClient()

        // Update all bookings to CANCELADA status
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: updatedBookings, error: updateError } = await (adminClient
            .from('bookings') as any)
            .update({
                status: 'CANCELADA',
                status_updated_by: user.id,
                status_updated_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .in('id', bookingIds)
            .select('id')

        if (updateError) {
            console.error('Bulk cancel error:', updateError)
            return NextResponse.json(
                { error: 'Error al cancelar las reservas' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            updatedCount: updatedBookings?.length || 0,
            message: `${updatedBookings?.length || 0} reservas canceladas`,
        })
    } catch (error) {
        console.error('Bulk cancel API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
