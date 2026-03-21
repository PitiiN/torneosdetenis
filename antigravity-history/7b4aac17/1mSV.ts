import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema for booking update
const updateBookingSchema = z.object({
    field_id: z.string().uuid().optional(),
    user_id: z.string().uuid().nullable().optional(),
    status: z.enum([
        'PENDIENTE_PAGO',
        'EN_VERIFICACION',
        'PAGADA',
        'CANCELADA',
        'BLOQUEADA',
        'EXPIRADA'
    ]).optional(),
    start_at: z.string().datetime({ offset: true }).optional(),
    end_at: z.string().datetime({ offset: true }).optional(),
    duration_minutes: z.number().positive().optional(),
    price_total_cents: z.number().min(0).optional(),
    verification_note: z.string().optional(),
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
        const validation = updateBookingSchema.safeParse(body)
        if (!validation.success) {
            console.error('Validation error:', JSON.stringify(validation.error.flatten(), null, 2))
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            )
        }

        const updateData = validation.data

        // Use admin client for the update
        const adminClient = await createAdminClient()

        // Check booking exists
        const { data: existingBooking, error: fetchError } = await adminClient
            .from('bookings')
            .select('*')
            .eq('id', id)
            .single()

        if (fetchError || !existingBooking) {
            return NextResponse.json(
                { error: 'Reserva no encontrada' },
                { status: 404 }
            )
        }

        // Build update object
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatePayload: any = {
            ...updateData,
            updated_at: new Date().toISOString(),
        }

        // If status is changing, track who made the change
        if (updateData.status) {
            updatePayload.status_updated_by = user.id
            updatePayload.status_updated_at = new Date().toISOString()
        }

        console.log('Update Payload:', JSON.stringify(updatePayload, null, 2))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: updatedBookingRaw, error: updateError } = await (adminClient
            .from('bookings') as any)
            .update(updatePayload)
            .eq('id', id)
            .select(`
                *,
                field:fields(*)
            `)
            .single()

        if (updateError) {
            console.error('Update error details:', JSON.stringify(updateError, null, 2))
            return NextResponse.json(
                { error: 'Error al actualizar la reserva', details: updateError },
                { status: 500 }
            )
        }

        // Manual join for user profile
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let updatedBooking: any = { ...updatedBookingRaw }
        if (updatedBooking.user_id) {
            const { data: profile } = await adminClient
                .from('profiles')
                .select('id, full_name, phone')
                .eq('id', updatedBooking.user_id)
                .single()

            if (profile) {
                updatedBooking.user = profile
            }
        }


        if (updatedBooking) {
            // Check if status changed to PAGADA and send email
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const safeExisting = existingBooking as any
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const safeBooking = updatedBooking as any

            if (updateData.status === 'PAGADA' && safeExisting.status !== 'PAGADA') {
                // File logging removed

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let userEmail = safeBooking.user?.email

                if (!userEmail && safeBooking.user_id) {
                    // Fetch from auth.users via admin API since profiles table doesn't have email
                    const { data: { user }, error: userError } = await adminClient.auth.admin.getUserById(safeBooking.user_id)
                    if (!userError && user) {
                        userEmail = user.email
                    } else {
                        console.error('Failed to fetch user email from auth admin:', userError)
                    }
                }

                // TEMPORARY TEST OVERRIDE: Send all emails to admin for verification
                // This allows testing while domain verification is pending.
                const testEmailParams = 'jaravena@f2sports.cl';
                console.log(`[TEST MODE] Overriding recipient ${userEmail} to ${testEmailParams}`);
                userEmail = testEmailParams;

                if (userEmail && safeBooking.field?.name) {
                    try {
                        const { sendBookingConfirmationEmail } = await import('@/lib/email')
                        await sendBookingConfirmationEmail(userEmail, safeBooking.field.name)
                    } catch (e) {
                        console.error('Failed to send confirmation email', e)
                    }
                }
            } else {
                // Condition failed logic removed
            }
        }

        return NextResponse.json({
            success: true,
            booking: updatedBooking,
            message: 'Reserva actualizada exitosamente',
        })
    } catch (error) {
        console.error('Admin booking update API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
