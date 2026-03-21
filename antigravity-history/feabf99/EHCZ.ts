import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { addMinutes, format, parseISO } from 'date-fns'

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

        const { fieldId, startAt, durationMinutes } = validation.data

        // Force calculation of endAt on server to ensure duration consistency
        // Parse as ISO (local time agnostic) -> Add Duration -> Format back to ISO without TZ
        // This ensures if Start is 18:30, End is ALWAYS 19:30 regardless of client payload
        const startDate = parseISO(startAt)
        const endDate = addMinutes(startDate, durationMinutes)
        const calculatedEndAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss")

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
                end_at: calculatedEndAt, // Use calculated time
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
