import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateBookingSchema = z.object({
    status: z.enum(['CANCELADA']).optional(),
    paymentProofPath: z.string().optional(),
    paymentReference: z.string().optional(),
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

        const body = await request.json()

        // Validate input
        const validation = updateBookingSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            )
        }

        // Check if booking exists and belongs to user
        const { data: existingBooking, error: fetchError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (fetchError || !existingBooking) {
            return NextResponse.json(
                { error: 'Reserva no encontrada' },
                { status: 404 }
            )
        }

        // Check if booking can be modified
        if (['PAGADA', 'BLOQUEADA'].includes(existingBooking.status)) {
            return NextResponse.json(
                { error: 'Esta reserva no puede ser modificada' },
                { status: 403 }
            )
        }

        const { status, paymentProofPath, paymentReference } = validation.data
        const updateData: Record<string, unknown> = {}

        if (status === 'CANCELADA') {
            updateData.status = 'CANCELADA'
        }

        if (paymentProofPath) {
            updateData.payment_proof_path = paymentProofPath
            updateData.status = 'EN_VERIFICACION'
        }

        if (paymentReference) {
            updateData.payment_reference = paymentReference
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: 'No hay cambios que realizar' },
                { status: 400 }
            )
        }

        const { data: booking, error: updateError } = await supabase
            .from('bookings')
            .update(updateData)
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
            booking,
            message: status === 'CANCELADA'
                ? 'Reserva cancelada exitosamente'
                : 'Reserva actualizada exitosamente',
        })
    } catch (error) {
        console.error('Booking update API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

        const { data: booking, error } = await supabase
            .from('bookings')
            .select('*, field:fields(*)')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (error || !booking) {
            return NextResponse.json(
                { error: 'Reserva no encontrada' },
                { status: 404 }
            )
        }

        return NextResponse.json({ booking })
    } catch (error) {
        console.error('Booking fetch API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
