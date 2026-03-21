import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createBookingSchema = z.object({
    fieldId: z.string().uuid(),
    startAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid date format"
    }),
    endAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid date format"
    }),
    durationMinutes: z.number().positive(),
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

        const body = await request.json()

        // Validate input
        const validation = createBookingSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            )
        }

        const { fieldId, startAt, endAt, durationMinutes } = validation.data

        // Check field exists and is active
        const { data: field, error: fieldError } = await supabase
            .from('fields')
            .select('id, name')
            .eq('id', fieldId)
            .eq('is_active', true)
            .single()

        if (fieldError || !field) {
            return NextResponse.json(
                { error: 'Campo no encontrado o no disponible' },
                { status: 404 }
            )
        }

        // Try to create the booking - DB constraint will prevent overlaps
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: booking, error: bookingError } = await (supabase
            .from('bookings') as any)
            .insert({
                user_id: user.id,
                field_id: fieldId,
                start_at: startAt,
                end_at: endAt,
                duration_minutes: durationMinutes,
                status: 'PENDIENTE_PAGO',
                created_source: 'portal',
            })
            .select()
            .single()

        if (bookingError) {
            // Check if it's an overlap constraint violation
            if (bookingError.code === '23P01' || bookingError.message.includes('bookings_no_overlap')) {
                return NextResponse.json(
                    { error: 'Este horario ya está reservado. Por favor selecciona otro.' },
                    { status: 409 }
                )
            }
            console.error('Booking error:', bookingError)
            return NextResponse.json(
                { error: 'Error al crear la reserva' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            booking,
            message: 'Reserva creada exitosamente',
        })
    } catch (error) {
        console.error('Bookings API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

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

        // Auto-expire old pending bookings (Lazy expiration)
        // If booking is PENDIENTE_PAGO and created > 10 mins ago -> EXPIRADA
        try {
            const expirationTime = new Date(Date.now() - 10 * 60 * 1000).toISOString()
            const adminSupabase = await createAdminClient()
            await (adminSupabase
                .from('bookings') as any)
                .update({ status: 'EXPIRADA' })
                .eq('status', 'PENDIENTE_PAGO')
                .lt('created_at', expirationTime)
        } catch (expireError) {
            console.error('Error auto-expiring bookings:', expireError)
            // Continue even if expiration fails
        }

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const fieldId = searchParams.get('fieldId')

        let query = supabase
            .from('bookings')
            .select('*, field:fields(*)')
            .eq('user_id', user.id)
            .order('start_at', { ascending: false })

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
        console.error('Bookings API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
