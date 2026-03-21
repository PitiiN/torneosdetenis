import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { addMinutes, format, parseISO } from 'date-fns'

const createBookingSchema = z.object({
    fieldId: z.string().uuid(),
    startAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid date format"
    }),
    endAt: z.string().optional(), // We ignore this but keep it in validation if sent
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

        // Force calculation of endAt on server
        const startDate = parseISO(startAt)
        const endDate = addMinutes(startDate, durationMinutes)
        const calculatedEndAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss")

        // Check field exists
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

        // Check for overlaps MANUALLY to handle "Expired Hold" cleanup
        // We look for any booking that overlaps with our requested time
        const { data: overlaps } = await supabase
            .from('bookings')
            .select('id, status, created_at')
            .eq('field_id', fieldId)
            // Overlap logic: (StartA < EndB) AND (EndA > StartB)
            .lt('start_at', calculatedEndAt)
            .gt('end_at', startAt)
            .not('status', 'in', '("CANCELADA","RECHAZADA")') // Ignore already cancelled

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conflicts = overlaps as any[] | null

        if (conflicts && conflicts.length > 0) {
            const now = Date.now()
            // Check if ALL overlaps are Expired Pending bookings
            const canCleanup = conflicts.every(b => {
                if (b.status !== 'PENDIENTE_PAGO') return false
                const created = new Date(b.created_at).getTime()
                // Strict 10 min check (same as frontend/availability API)
                return (now - created > 10 * 60 * 1000)
            })

            if (canCleanup) {
                // Delete the expired holds to free up the slot
                const idsToDelete = conflicts.map(b => b.id)
                await supabase.from('bookings').delete().in('id', idsToDelete)
            } else {
                // Real conflict exists
                return NextResponse.json(
                    { error: 'Este horario ya está reservado. Por favor selecciona otro.' },
                    { status: 409 }
                )
            }
        }

        // Create the booking
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: booking, error: bookingError } = await (supabase
            .from('bookings') as any)
            .insert({
                user_id: user.id,
                field_id: fieldId,
                start_at: startAt,
                end_at: calculatedEndAt,
                duration_minutes: durationMinutes,
                status: 'PENDIENTE_PAGO',
                created_source: 'portal',
            })
            .select()
            .single()

        if (bookingError) {
            // Fallback for race conditions
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

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Restore field relation using Admin-verified syntax
        const { data: bookings, error } = await supabase
            .from('bookings')
            .select('*, field:fields(*)')
            .eq('user_id', user.id)
            .order('start_at', { ascending: false })

        if (error) {
            console.error('Error fetching bookings:', error)
            return NextResponse.json({ error: 'Error fetching bookings' }, { status: 500 })
        }

        return NextResponse.json({ bookings })
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
