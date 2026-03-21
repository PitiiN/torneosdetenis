import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema for verification action
const verifyBookingSchema = z.object({
    action: z.enum(['approve', 'reject']),
    note: z.string().optional(),
})

interface RouteParams {
    params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
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
        const validation = verifyBookingSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            )
        }

        const { action, note } = validation.data

        // Use admin client for the update
        const adminClient = await createAdminClient()

        // Get the booking
        const { data: booking, error: fetchError } = await adminClient
            .from('bookings')
            .select('*')
            .eq('id', id)
            .single()

        if (fetchError || !booking) {
            return NextResponse.json(
                { error: 'Reserva no encontrada' },
                { status: 404 }
            )
        }

        const typedBooking = booking as { status: string }
        // Only allow verification of bookings in EN_VERIFICACION status
        if (typedBooking.status !== 'EN_VERIFICACION') {
            return NextResponse.json(
                { error: 'Esta reserva no está pendiente de verificación' },
                { status: 400 }
            )
        }

        const newStatus = action === 'approve' ? 'PAGADA' : 'CANCELADA'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: updatedBooking, error: updateError } = await (adminClient
            .from('bookings') as any)
            .update({
                status: newStatus,
                verification_note: note || null,
                status_updated_by: user.id,
                status_updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single()

        if (updateError) {
            console.error('Update error:', updateError)
            return NextResponse.json(
                { error: 'Error al actualizar la reserva' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            booking: updatedBooking,
            message: action === 'approve'
                ? 'Pago verificado exitosamente'
                : 'Pago rechazado',
        })
    } catch (error) {
        console.error('Admin verify API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
